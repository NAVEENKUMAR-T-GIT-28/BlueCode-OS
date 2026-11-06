import { Router } from "express";
import { z } from "zod";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok, HttpError, findOwned, uuidParams, assertUuid, uuid, logActivity, recordUsage } from "../../../shared/helpers.js";

const r = Router();
r.use(requireAuth);
r.param("id", (req, res, next) => uuidParams("id")(req, res, next));

const str = (n) => z.string().trim().max(n).nullable().optional();

// Keyword fallback used when no AI classification is supplied
const classify = (text) => {
  const s = text.toLowerCase();
  if (/(not interested|unsubscribe|remove me|no thanks|stop emailing)/.test(s)) return "negative";
  if (/(maybe|not now|later|next (quarter|month)|send (more )?(info|details))/.test(s)) return "neutral";
  if (/(interested|sounds good|let'?s (talk|chat|meet)|schedule|book|call|demo|available)/.test(s)) return "positive";
  return "unknown";
};
const STATUS_BY_INTENT = { positive: "Interested", negative: "Not interested", neutral: "Contacted" };

// GET /outreach?prospect_id=&status=
r.get("/", wrap(async (req, res) => {
  let q = db.from("outreach").select("*, outreach_replies(*), follow_ups(*)")
    .eq("startup_id", req.user.startupId).order("created_at", { ascending: false });
  if (req.query.prospect_id) { assertUuid(req.query.prospect_id, "prospect_id"); q = q.eq("prospect_id", req.query.prospect_id); }
  if (req.query.status) q = q.eq("status", String(req.query.status));
  res.json({ outreach: ok(await q) });
}));

const createSchema = z.object({
  prospect_id: uuid, decision_maker_id: uuid.nullable().optional(),
  subject: z.string().trim().max(300).default(""), body: z.string().max(10000).default(""),
  draft_provider: str(50), draft_model: str(100)
});
r.post("/", wrap(async (req, res) => {
  const d = parse(createSchema, req.body);
  const prospect = await findOwned("prospects", d.prospect_id, req.user.startupId, "id,company");
  if (d.decision_maker_id) {
    const contact = await findOwned("decision_makers", d.decision_maker_id, req.user.startupId, "id,prospect_id");
    if (contact.prospect_id !== prospect.id) throw new HttpError(400, "Decision maker must belong to the selected prospect");
  }
  const row = ok(await db.from("outreach").insert({
    ...d, startup_id: req.user.startupId,
    draft_generated_at: d.draft_provider ? new Date().toISOString() : null
  }).select().single());
  if (d.draft_provider) recordUsage(req.user.startupId, req.user.id, "email_draft");
  logActivity(req.user.startupId, req.user.id, "Outreach draft created", prospect.company, "mail", prospect.id);
  res.status(201).json({ outreach: row });
}));

const patchSchema = z.object({ subject: z.string().trim().max(300), body: z.string().max(10000) }).partial();
r.patch("/:id", wrap(async (req, res) => {
  const cur = await findOwned("outreach", req.params.id, req.user.startupId);
  if (cur.status !== "draft") throw new HttpError(409, "Only drafts can be edited");
  const row = ok(await db.from("outreach").update(parse(patchSchema, req.body))
    .eq("id", cur.id).eq("startup_id", req.user.startupId).select().single());
  res.json({ outreach: row });
}));

// Approve only. No email is sent in this MVP.
r.post("/:id/approve", wrap(async (req, res) => {
  const cur = await findOwned("outreach", req.params.id, req.user.startupId);
  if (cur.status !== "draft") throw new HttpError(409, "Already approved");
  const row = ok(await db.from("outreach").update({ status: "approved", approved_at: new Date().toISOString() })
    .eq("id", cur.id).eq("startup_id", req.user.startupId).select().single());
  logActivity(req.user.startupId, req.user.id, "Initial email approved", "No email was sent.", "check", cur.prospect_id);
  res.json({ outreach: row });
}));

// Save a pasted reply and classify intent
const replySchema = z.object({
  body: z.string().trim().min(1).max(10000),
  intent: z.enum(["positive", "neutral", "negative", "unknown"]).optional(),
  intent_reason: str(500), intent_source: str(50)
});
r.post("/:id/replies", wrap(async (req, res) => {
  const out = await findOwned("outreach", req.params.id, req.user.startupId);
  const d = parse(replySchema, req.body);
  const intent = d.intent ?? classify(d.body);
  const reply = ok(await db.from("outreach_replies").insert({
    startup_id: req.user.startupId, outreach_id: out.id, body: d.body, intent,
    intent_reason: d.intent_reason ?? null, intent_source: d.intent_source ?? (d.intent ? "client" : "keyword")
  }).select().single());

  ok(await db.from("outreach").update({ status: "replied" }).eq("id", out.id).eq("startup_id", req.user.startupId));
  if (STATUS_BY_INTENT[intent])
    ok(await db.from("prospects").update({ pipeline_status: STATUS_BY_INTENT[intent], status_changed_at: new Date().toISOString() })
      .eq("id", out.prospect_id).eq("startup_id", req.user.startupId));
  // Stop pending follow-ups once the prospect replies
  await db.from("follow_ups").update({ status: "cancelled" })
    .eq("outreach_id", out.id).eq("startup_id", req.user.startupId).eq("status", "pending");
  logActivity(req.user.startupId, req.user.id, `${intent} reply recorded`, "Reply saved and classified.", "mail", out.prospect_id);
  res.status(201).json({ reply });
}));

// Save the drafted response to a reply
const responseSchema = z.object({
  response_subject: str(300), response_body: z.string().max(10000).nullable().optional(),
  response_saved: z.boolean().optional(), intent: z.enum(["positive", "neutral", "negative", "unknown"]).optional()
});
r.patch("/:id/replies/:replyId", wrap(async (req, res) => {
  assertUuid(req.params.replyId, "replyId");
  await findOwned("outreach", req.params.id, req.user.startupId, "id");
  const reply = ok(await db.from("outreach_replies").update(parse(responseSchema, req.body))
    .eq("id", req.params.replyId).eq("outreach_id", req.params.id).eq("startup_id", req.user.startupId).select().single());
  res.json({ reply });
}));

// Follow-ups (#1, #2): create/update a record. Nothing is sent.
const fuSchema = z.object({
  sequence_no: z.union([z.literal(1), z.literal(2)]),
  subject: str(300), body: z.string().max(10000).nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  status: z.enum(["pending", "recorded", "sent", "cancelled"]).default("pending")
});
r.post("/:id/follow-ups", wrap(async (req, res) => {
  const out = await findOwned("outreach", req.params.id, req.user.startupId);
  const d = parse(fuSchema, req.body);
  const row = ok(await db.from("follow_ups").upsert({
    ...d, outreach_id: out.id, startup_id: req.user.startupId,
    completed_at: d.status === "recorded" || d.status === "sent" ? new Date().toISOString() : null
  }, { onConflict: "outreach_id,sequence_no" }).select().single());
  if (d.status === "recorded")
    logActivity(req.user.startupId, req.user.id, `Follow-up ${d.sequence_no} recorded`, "No real email was sent.", "mail", out.prospect_id);
  res.status(201).json({ followUp: row });
}));

r.delete("/:id", wrap(async (req, res) => {
  const out = await findOwned("outreach", req.params.id, req.user.startupId, "id");
  ok(await db.from("outreach").delete().eq("id", out.id).eq("startup_id", req.user.startupId));
  res.json({ deleted: true });
}));

export default r;
