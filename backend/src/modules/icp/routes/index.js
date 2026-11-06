import { Router } from "express";
import { z } from "zod";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok, HttpError, logActivity } from "../../../shared/helpers.js";

const r = Router();
r.use(requireAuth);

const list = z.array(z.string().trim().min(1).max(100)).max(30);
const icpSchema = z.object({
  name: z.string().trim().min(1).max(100).default("Primary ICP"),
  industries: list.default([]),
  company_size: z.string().trim().max(100).default(""),
  geography: z.string().trim().max(200).default(""),
  roles: list.default([]),
  pain_points: z.string().trim().max(2000).default(""),
  exclusions: z.string().trim().max(2000).default("")
});

const current = async (startupId) =>
  ok(await db.from("icps").select("*").eq("startup_id", startupId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle());

r.get("/", wrap(async (req, res) => res.json({ icp: await current(req.user.startupId) })));

// Create or update the startup's ICP. Any edit requires re-approval.
r.put("/", wrap(async (req, res) => {
  const d = parse(icpSchema, req.body);
  const existing = await current(req.user.startupId);
  const row = { ...d, is_approved: false, approved_at: null };
  const icp = existing
    ? ok(await db.from("icps").update(row).eq("id", existing.id).eq("startup_id", req.user.startupId).select().single())
    : ok(await db.from("icps").insert({ ...row, startup_id: req.user.startupId }).select().single());
  res.json({ icp });
}));

r.post("/approve", wrap(async (req, res) => {
  const existing = await current(req.user.startupId);
  if (!existing) throw new HttpError(404, "Create an ICP first");
  const icp = ok(await db.from("icps")
    .update({ is_approved: true, approved_at: new Date().toISOString() })
    .eq("id", existing.id).eq("startup_id", req.user.startupId).select().single());
  logActivity(req.user.startupId, req.user.id, "ICP approved", "Your approved ICP is now in use.", "check");
  res.json({ icp });
}));

export default r;
