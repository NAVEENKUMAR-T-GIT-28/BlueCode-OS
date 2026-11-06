import { Router } from "express";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, ok, HttpError } from "../../../shared/helpers.js";

const r = Router();
r.use(requireAuth);

const count = async (q) => {
  const { count: c, error } = await q;
  if (error) throw error;
  return c ?? 0;
};

r.get("/dashboard", wrap(async (req, res) => {
  const sid = req.user.startupId;
  const P = () => db.from("prospects").select("id", { count: "exact", head: true }).eq("startup_id", sid);
  const [total, hot, high, medium, low, contacted, interested, followUpsDue, messagesReady] = await Promise.all([
    count(P()), count(P().eq("priority", "Hot")), count(P().eq("priority", "High")),
    count(P().eq("priority", "Medium")), count(P().eq("priority", "Low")),
    count(P().eq("pipeline_status", "Contacted")), count(P().eq("pipeline_status", "Interested")),
    count(db.from("follow_ups").select("id", { count: "exact", head: true })
      .eq("startup_id", sid).eq("status", "pending").lte("due_at", new Date().toISOString())),
    count(db.from("outreach").select("id", { count: "exact", head: true }).eq("startup_id", sid).eq("status", "draft"))
  ]);
  const activities = ok(await db.from("activities").select("*").eq("startup_id", sid)
    .order("created_at", { ascending: false }).limit(10));
  res.json({ counts: { total, hot, high, medium, low, contacted, interested, followUpsDue, messagesReady }, activities });
}));

r.get("/activities", wrap(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit) || 25);
  res.json({ activities: ok(await db.from("activities").select("*").eq("startup_id", req.user.startupId)
    .order("created_at", { ascending: false }).limit(limit)) });
}));

r.get("/follow-ups", wrap(async (req, res) => {
  let q = db.from("follow_ups").select("*, outreach(id, subject, prospect_id)")
    .eq("startup_id", req.user.startupId).order("due_at", { ascending: true, nullsFirst: false });
  if (req.query.status) q = q.eq("status", String(req.query.status));
  res.json({ followUps: ok(await q) });
}));

// Update or delete a scheduled follow-up record. These are records only; no message is sent.
r.patch("/follow-ups/:id", wrap(async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "Invalid follow-up id");
  const allowed = new Set(["pending", "recorded", "sent", "cancelled"]);
  const patch = {};
  if (req.body.status !== undefined) {
    if (!allowed.has(req.body.status)) throw new HttpError(400, "Invalid follow-up status");
    patch.status = req.body.status;
    patch.completed_at = ["recorded", "sent"].includes(req.body.status) ? new Date().toISOString() : null;
  }
  if (req.body.due_at !== undefined) {
    if (req.body.due_at !== null && Number.isNaN(Date.parse(req.body.due_at))) throw new HttpError(400, "Invalid due_at");
    patch.due_at = req.body.due_at;
  }
  if (req.body.subject !== undefined) patch.subject = String(req.body.subject).slice(0, 300);
  if (req.body.body !== undefined) patch.body = String(req.body.body).slice(0, 10000);
  if (!Object.keys(patch).length) throw new HttpError(400, "Provide at least one field to update");
  const { data, error } = await db.from("follow_ups").update(patch)
    .eq("id", id).eq("startup_id", req.user.startupId).select().maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Follow-up not found" });
  res.json({ followUp: data });
}));

r.delete("/follow-ups/:id", wrap(async (req, res) => {
  const id = String(req.params.id);
  const { data, error } = await db.from("follow_ups").delete()
    .eq("id", id).eq("startup_id", req.user.startupId).select("id").maybeSingle();
  if (error) throw error;
  res.json({ deleted: !!data });
}));

// Usage vs plan limits (tracked only; not enforced in this MVP)
r.get("/usage", wrap(async (req, res) => {
  const sid = req.user.startupId;
  const sub = ok(await db.from("subscriptions").select("*, plans(*)").eq("startup_id", sid)
    .order("created_at", { ascending: false }).limit(1).maybeSingle());
  const events = ok(await db.from("usage_events").select("kind, units, cost_inr")
    .eq("startup_id", sid).gte("created_at", sub?.started_at ?? new Date(0).toISOString()));
  const used = {}; let cost = 0;
  for (const e of events) { used[e.kind] = (used[e.kind] || 0) + e.units; cost += Number(e.cost_inr); }
  res.json({ subscription: sub, used, estimatedCostInr: Math.round(cost * 100) / 100 });
}));

export default r;
