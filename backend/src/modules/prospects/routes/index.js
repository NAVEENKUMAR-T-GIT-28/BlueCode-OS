import { Router } from "express";
import { z } from "zod";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok, HttpError, findOwned, uuidParams, assertUuid, uuid, logActivity } from "../../../shared/helpers.js";

const r = Router();
r.use(requireAuth);
r.param("id", (req, res, next) => uuidParams("id")(req, res, next));

const str = (n) => z.string().trim().max(n).nullable().optional();
const prospectFields = z.object({
  company: z.string().trim().min(1).max(200),
  domain: z.string().trim().toLowerCase().max(253).nullable().optional(),
  website: str(2048), industry: str(200), location: str(200), company_size: str(100),
  description: str(2000), source: str(100), score_source: str(50), why_now: str(2000),
  icp_fit_score: z.number().int().min(0).max(100).nullable().optional(),
  icp_evaluated: z.boolean().optional(),
  fit_reasons: z.array(z.string().max(500)).max(20).optional(),
  evaluation: z.record(z.any()).nullable().optional(),
  pipeline_status: z.string().trim().min(1).max(60).optional(),
  icp_id: uuid.nullable().optional()
});
const patchSchema = prospectFields.partial();

const normalize = (d) => { if (d.domain === "") d.domain = null; return d; };
const SORT = { score: "icp_fit_score", company: "company", created: "created_at", updated: "status_changed_at" };

// GET /prospects?priority=Hot,High&status=Contacted&q=acme&sort=score&order=desc&page=1&limit=25
r.get("/", wrap(async (req, res) => {
  const { priority, status, q, sort = "score", order = "desc" } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));

  let query = db.from("prospects").select("*", { count: "exact" }).eq("startup_id", req.user.startupId);
  if (priority) query = query.in("priority", String(priority).split(",").filter((p) => ["Hot", "High", "Medium", "Low"].includes(p)));
  if (status) query = query.eq("pipeline_status", String(status));
  if (q) {
    const s = String(q).replace(/[%,()*\\]/g, " ").trim();
    if (s) query = query.or(`company.ilike.%${s}%,domain.ilike.%${s}%,industry.ilike.%${s}%`);
  }
  query = query.order(SORT[sort] || "icp_fit_score", { ascending: order === "asc", nullsFirst: false })
    .range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;
  if (error) { console.error(error); throw new HttpError(500, "Database error"); }
  res.json({ data, total: count ?? 0, page, limit });
}));

// POST /prospects  — one object, or { prospects: [...] } (max 50). Duplicate domains are skipped.
r.post("/", wrap(async (req, res) => {
  const items = Array.isArray(req.body?.prospects) ? req.body.prospects : [req.body];
  if (items.length > 50) throw new HttpError(400, "Max 50 prospects per request");
  const rows = items.map((i) => normalize(parse(prospectFields, i)));

  const domains = rows.map((x) => x.domain).filter(Boolean);
  let taken = new Set();
  if (domains.length) {
    const found = ok(await db.from("prospects").select("domain").eq("startup_id", req.user.startupId).in("domain", domains));
    taken = new Set(found.map((f) => f.domain));
  }
  const seen = new Set();
  const fresh = rows.filter((x) => {
    if (!x.domain) return true;
    if (taken.has(x.domain) || seen.has(x.domain)) return false;
    seen.add(x.domain); return true;
  }).map((x) => ({ ...x, source: x.source ?? "manual", startup_id: req.user.startupId }));

  const created = fresh.length ? ok(await db.from("prospects").insert(fresh).select()) : [];
  res.status(201).json({ created, skippedDuplicates: rows.length - fresh.length });
}));

r.get("/:id", wrap(async (req, res) => {
  const { data, error } = await db.from("prospects")
    .select("*, prospect_signals(*), decision_makers(*), outreach(*)")
    .eq("id", req.params.id).eq("startup_id", req.user.startupId).maybeSingle();
  if (error) { console.error(error); throw new HttpError(500, "Database error"); }
  if (!data) throw new HttpError(404, "Not found");
  res.json({ prospect: data });
}));

r.patch("/:id", wrap(async (req, res) => {
  const before = await findOwned("prospects", req.params.id, req.user.startupId);
  const d = normalize(parse(patchSchema, req.body));
  if (d.pipeline_status && d.pipeline_status !== before.pipeline_status) d.status_changed_at = new Date().toISOString();
  const prospect = ok(await db.from("prospects").update(d)
    .eq("id", req.params.id).eq("startup_id", req.user.startupId).select().single());
  if (d.pipeline_status && d.pipeline_status !== before.pipeline_status)
    logActivity(req.user.startupId, req.user.id, "Status updated", `${before.company}: ${d.pipeline_status}`, "check", before.id);
  res.json({ prospect });
}));

r.delete("/:id", wrap(async (req, res) => {
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  ok(await db.from("prospects").delete().eq("id", req.params.id).eq("startup_id", req.user.startupId));
  res.json({ deleted: true });
}));

// Replace the Trigger / Buying signal / Intent rows (with evidence) for a prospect
const signalSchema = z.object({
  signals: z.array(z.object({
    signal_type: z.enum(["trigger", "buying_signal", "intent"]),
    description: z.string().trim().min(1).max(1000),
    evidence: str(2000), evidence_url: str(2048),
    confidence: z.enum(["verified", "likely", "unverified"]).nullable().optional(),
    observed_at: z.string().datetime().nullable().optional()
  })).max(30)
});
r.put("/:id/signals", wrap(async (req, res) => {
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  const { signals } = parse(signalSchema, req.body);
  ok(await db.from("prospect_signals").delete().eq("prospect_id", req.params.id).eq("startup_id", req.user.startupId));
  const rows = signals.map((s) => ({ ...s, prospect_id: req.params.id, startup_id: req.user.startupId }));
  const saved = rows.length ? ok(await db.from("prospect_signals").insert(rows).select()) : [];
  res.json({ signals: saved });
}));

// Decision makers
const dmSchema = z.object({
  first_name: str(100), last_name: str(100),
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().nullable().optional(),
  position: str(200), department: str(100), seniority: str(100),
  is_decision_maker: z.boolean().optional(), is_primary: z.boolean().optional(),
  confidence: z.number().int().min(0).max(100).nullable().optional(),
  verification: str(50), provenance: str(50),
  sources: z.array(z.any()).max(20).optional()
});

r.get("/:id/decision-makers", wrap(async (req, res) => {
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  const data = ok(await db.from("decision_makers").select("*")
    .eq("prospect_id", req.params.id).eq("startup_id", req.user.startupId)
    .order("is_primary", { ascending: false }).order("confidence", { ascending: false, nullsFirst: false }));
  res.json({ contacts: data });
}));

r.post("/:id/decision-makers", wrap(async (req, res) => {
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  const items = Array.isArray(req.body?.contacts) ? req.body.contacts : [req.body];
  if (items.length > 10) throw new HttpError(400, "Max 10 contacts per request");
  const rows = items.map((i) => parse(dmSchema, i));

  const existing = ok(await db.from("decision_makers").select("is_primary,email")
    .eq("prospect_id", req.params.id).eq("startup_id", req.user.startupId));
  const emails = new Set(existing.map((e) => e.email).filter(Boolean));
  let hasPrimary = existing.some((e) => e.is_primary);

  const fresh = rows.filter((x) => !x.email || !emails.has(x.email)).map((x) => {
    const makePrimary = !hasPrimary && (x.is_primary ?? true);
    if (makePrimary) hasPrimary = true;
    return { ...x, is_primary: makePrimary, prospect_id: req.params.id, startup_id: req.user.startupId };
  });
  const created = fresh.length ? ok(await db.from("decision_makers").insert(fresh).select()) : [];
  res.status(201).json({ contacts: created, skippedDuplicates: rows.length - fresh.length });
}));

r.patch("/:id/decision-makers/:dmId", wrap(async (req, res) => {
  assertUuid(req.params.dmId, "dmId");
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  const patch = dmSchema.partial();
  const d = parse(patch, req.body);
  const contact = ok(await db.from("decision_makers").update(d)
    .eq("id", req.params.dmId).eq("prospect_id", req.params.id)
    .eq("startup_id", req.user.startupId).select().maybeSingle());
  if (!contact) throw new HttpError(404, "Decision maker not found");
  res.json({ contact });
}));

r.delete("/:id/decision-makers/:dmId", wrap(async (req, res) => {
  assertUuid(req.params.dmId, "dmId");
  await findOwned("prospects", req.params.id, req.user.startupId, "id");
  ok(await db.from("decision_makers").delete()
    .eq("id", req.params.dmId).eq("prospect_id", req.params.id).eq("startup_id", req.user.startupId));
  res.json({ deleted: true });
}));

export default r;
