import { Router } from "express";
import { z } from "zod";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok } from "../../../shared/helpers.js";
import { sha, prospectToDb, prospectToUi, outreachToDb, outreachToUi, idOf, timeLabel, activityId } from "../shared/workspaceMap.js";

// Compatibility layer: the React app reads/writes one "workspace" object.
// Here it is stored in real tables (startups, icps, prospects, signals, decision_makers, outreach, replies, activities).
const r = Router();
r.use(requireAuth);

const locks = new Map();
const withLock = (key, fn) => {
  const run = (locks.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  locks.set(key, tail);
  tail.then(() => { if (locks.get(key) === tail) locks.delete(key); });
  return run;
};
const chunks = (arr, n = 100) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const obj = z.object({}).passthrough();
const stateSchema = z.object({
  account: obj.optional(), startup: obj.optional(), icp: obj.nullable().optional(),
  icpApproved: z.boolean().optional(), bookingUrl: z.string().max(2048).optional(),
  prospects: z.array(obj).max(500).optional(), outreach: z.array(obj).max(1000).optional(),
  activities: z.array(obj).max(1000).optional()
}).passthrough();

// ───────── GET /workspace ─────────
r.get("/", wrap(async (req, res) => {
  const sid = req.user.startupId;
  const [startup, user, icp, prospects, outreach, acts] = await Promise.all([
    db.from("startups").select("*").eq("id", sid).single().then((x) => ok(x)),
    db.from("users").select("name,email").eq("id", req.user.id).single().then((x) => ok(x)),
    db.from("icps").select("*").eq("startup_id", sid).order("created_at", { ascending: false }).limit(1).maybeSingle().then((x) => ok(x)),
    db.from("prospects").select("*, prospect_signals(*), decision_makers(*)").eq("startup_id", sid)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true }).limit(1000).then((x) => ok(x)),
    db.from("outreach").select("*, outreach_replies(*)").eq("startup_id", sid)
      .order("sort_order", { ascending: false }).order("created_at", { ascending: false }).limit(1000).then((x) => ok(x)),
    db.from("activities").select("*").eq("startup_id", sid)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200).then((x) => ok(x))
  ]);

  const uiProspects = prospects.map(prospectToUi);
  const byRow = new Map(prospects.map((p, i) => [p.id, uiProspects[i]]));
  const state = {
    account: { name: user.name, email: user.email },
    startup: { companyName: startup.company_name, product: startup.product, geography: startup.geography,
      customers: startup.customers, objective: startup.sales_objective },
    ...(startup.ui || {}),
    setupComplete: startup.setup_complete,
    bookingUrl: startup.booking_url ?? "",
    icp: icp ? { name: icp.name, industries: icp.industries, size: icp.company_size, geography: icp.geography,
      roles: icp.roles, painPoints: icp.pain_points, exclusions: icp.exclusions, objective: icp.objective } : null,
    icpApproved: !!icp?.is_approved,
    prospects: uiProspects,
    outreach: outreach.map((o) => outreachToUi(o, byRow.get(o.prospect_id) && { ...byRow.get(o.prospect_id), id: byRow.get(o.prospect_id).id, client_ref: null })),
    activities: acts.map((a) => ({ id: activityId(a), title: a.title, detail: a.detail, time: timeLabel(a.created_at), kind: a.kind }))
  };
  res.json({ state, updatedAt: startup.updated_at, schemaVersion: 2 });
}));

// ───────── PUT /workspace ─────────
async function sync(user, st) {
  const sid = user.startupId;
  const base = Date.now() * 1000;

  // startup + account name
  if (st.startup || st.bookingUrl !== undefined || st.setupComplete !== undefined) {
    const sp = st.startup || {};
    const patch = { ui: { selectedPlan: st.selectedPlan, accountCreated: st.accountCreated, selectedProspectId: st.selectedProspectId } };
    if (st.startup) Object.assign(patch, {
      company_name: String(sp.companyName ?? "").slice(0, 200), product: String(sp.product ?? "").slice(0, 1000),
      geography: String(sp.geography ?? "").slice(0, 200), customers: String(sp.customers ?? "").slice(0, 1000)
    });
    if (st.bookingUrl !== undefined) patch.booking_url = /^https:\/\/\S+$/i.test(st.bookingUrl) ? st.bookingUrl : null;
    if (st.setupComplete !== undefined) patch.setup_complete = !!st.setupComplete;
    ok(await db.from("startups").update(patch).eq("id", sid));
  }
  if (st.account?.name) ok(await db.from("users").update({ name: String(st.account.name).slice(0, 100) }).eq("id", user.id));

  // ICP
  if (st.icp === null) {
    ok(await db.from("icps").delete().eq("startup_id", sid));
  } else if (st.icp) {
    const i = st.icp;
    const row = {
      name: String(i.name || "Primary ICP").slice(0, 100),
      industries: (Array.isArray(i.industries) ? i.industries : []).slice(0, 30).map(String),
      company_size: String(i.size ?? "").slice(0, 100), geography: String(i.geography ?? "").slice(0, 200),
      roles: (Array.isArray(i.roles) ? i.roles : []).slice(0, 30).map(String),
      pain_points: String(i.painPoints ?? "").slice(0, 2000), exclusions: String(i.exclusions ?? "").slice(0, 2000),
      is_approved: !!st.icpApproved
    };
    const cur = ok(await db.from("icps").select("id,is_approved").eq("startup_id", sid)
      .order("created_at", { ascending: false }).limit(1).maybeSingle());
    if (cur) {
      if (row.is_approved && !cur.is_approved) row.approved_at = new Date().toISOString();
      if (!row.is_approved) row.approved_at = null;
      ok(await db.from("icps").update(row).eq("id", cur.id).eq("startup_id", sid));
    } else {
      ok(await db.from("icps").insert({ ...row, startup_id: sid, approved_at: row.is_approved ? new Date().toISOString() : null }));
    }
  }

  // Prospects (+ signals + primary decision maker)
  const rowIdOf = new Map();
  if (st.prospects) {
    const ex = ok(await db.from("prospects").select("id,client_ref,sync_hash,domain").eq("startup_id", sid));
    const byRef = new Map(), byId = new Map(), domainOwner = new Map();
    for (const e of ex) {
      if (e.client_ref) { byRef.set(e.client_ref, e); rowIdOf.set(e.client_ref, e.id); }
      byId.set(e.id, e); rowIdOf.set(e.id, e.id);
      if (e.domain) domainOwner.set(e.domain, e.id);
    }
    const ins = [], upd = [];
    st.prospects.forEach((p, i) => {
      if (!p || p.id == null) return;
      const X = String(p.id);
      const { row, signals, dm } = prospectToDb(p);
      const found = byRef.get(X) || byId.get(X);
      const key = found ? found.id : `new:${X}`;
      if (row.domain) {
        const owner = domainOwner.get(row.domain);
        if (owner && owner !== key) row.domain = null; else domainOwner.set(row.domain, key);
      }
      const hash = sha({ row, signals, dm });
      if (found) { if (found.sync_hash !== hash) upd.push({ found, row, signals, dm, hash }); }
      else ins.push({ X, row, signals, dm, hash, order: i });
    });

    for (const part of chunks(ins)) {
      const created = ok(await db.from("prospects")
        .insert(part.map((x) => ({ ...x.row, startup_id: sid, client_ref: x.X, sync_hash: x.hash, sort_order: base + x.order })))
        .select("id,client_ref"));
      const idByRef = new Map(created.map((c) => [c.client_ref, c.id]));
      const sigRows = [], dmRows = [];
      for (const x of part) {
        const id = idByRef.get(x.X); rowIdOf.set(x.X, id);
        x.signals.forEach((sg) => sigRows.push({ ...sg, startup_id: sid, prospect_id: id }));
        if (x.dm) dmRows.push({ ...x.dm, startup_id: sid, prospect_id: id });
      }
      if (sigRows.length) ok(await db.from("prospect_signals").insert(sigRows));
      if (dmRows.length) ok(await db.from("decision_makers").insert(dmRows));
    }
    for (const u of upd) {
      const id = u.found.id;
      ok(await db.from("prospects").update({ ...u.row, sync_hash: u.hash }).eq("id", id).eq("startup_id", sid));
      ok(await db.from("prospect_signals").delete().eq("prospect_id", id).eq("startup_id", sid));
      if (u.signals.length) ok(await db.from("prospect_signals").insert(u.signals.map((sg) => ({ ...sg, startup_id: sid, prospect_id: id }))));
      ok(await db.from("decision_makers").delete().eq("prospect_id", id).eq("startup_id", sid).eq("provenance", "workspace"));
      if (u.dm) ok(await db.from("decision_makers").insert({ ...u.dm, startup_id: sid, prospect_id: id }));
    }
  }

  // Outreach (+ latest reply)
  if (st.outreach) {
    if (!rowIdOf.size) {
      const ex = ok(await db.from("prospects").select("id,client_ref").eq("startup_id", sid));
      for (const e of ex) { rowIdOf.set(e.id, e.id); if (e.client_ref) rowIdOf.set(e.client_ref, e.id); }
    }
    const ex = ok(await db.from("outreach").select("id,client_ref,sync_hash").eq("startup_id", sid));
    const byRef = new Map(), byId = new Map();
    for (const e of ex) { if (e.client_ref) byRef.set(e.client_ref, e); byId.set(e.id, e); }
    const ins = [], upd = [];
    st.outreach.forEach((o, i) => {
      if (!o || o.id == null) return;
      const X = String(o.id);
      const prospectId = rowIdOf.get(String(o.prospectId));
      if (!prospectId) return;
      const { row, reply } = outreachToDb(o);
      const hash = sha({ row, reply, prospectId });
      const found = byRef.get(X) || byId.get(X);
      if (found) { if (found.sync_hash !== hash) upd.push({ found, row, reply, hash, prospectId }); }
      else ins.push({ X, row, reply, hash, prospectId, order: i });
    });
    for (const part of chunks(ins)) {
      const created = ok(await db.from("outreach")
        .insert(part.map((x) => ({ ...x.row, startup_id: sid, prospect_id: x.prospectId, client_ref: x.X, sync_hash: x.hash, sort_order: base - x.order })))
        .select("id,client_ref"));
      const idByRef = new Map(created.map((c) => [c.client_ref, c.id]));
      const replies = part.filter((x) => x.reply).map((x) => ({ ...x.reply, startup_id: sid, outreach_id: idByRef.get(x.X) }));
      if (replies.length) ok(await db.from("outreach_replies").insert(replies));
    }
    for (const u of upd) {
      const id = u.found.id;
      ok(await db.from("outreach").update({ ...u.row, prospect_id: u.prospectId, sync_hash: u.hash }).eq("id", id).eq("startup_id", sid));
      ok(await db.from("outreach_replies").delete().eq("outreach_id", id).eq("startup_id", sid).eq("intent_source", "workspace"));
      if (u.reply) ok(await db.from("outreach_replies").insert({ ...u.reply, startup_id: sid, outreach_id: id }));
    }
  }

  // Activities: append-only (new items only)
  if (st.activities) {
    const ex = ok(await db.from("activities").select("id,client_ref").eq("startup_id", sid));
    const known = new Set(ex.flatMap((e) => [String(e.id), e.client_ref].filter(Boolean)));
    const fresh = [...st.activities].reverse().filter((a) => a && a.id != null && !known.has(String(a.id)))
      .map((a) => ({ startup_id: sid, user_id: user.id, title: String(a.title ?? "").slice(0, 300),
        detail: String(a.detail ?? "").slice(0, 2000), kind: String(a.kind ?? "mail").slice(0, 30), client_ref: String(a.id) }));
    for (const part of chunks(fresh)) ok(await db.from("activities").insert(part));
  }
}

r.put("/", wrap(async (req, res) => {
  const { state } = parse(z.object({ state: stateSchema }), req.body);
  await withLock(req.user.startupId, () => sync(req.user, state));
  res.json({ saved: true, updatedAt: new Date().toISOString() });
}));

export default r;
