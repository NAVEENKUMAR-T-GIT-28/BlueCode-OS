import { Router } from "express";
import { z } from "zod";
import { db } from "../../../infrastructure/database/supabase.js";
import { requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok } from "../../../shared/helpers.js";

const r = Router();
r.use(requireAuth);

const patchSchema = z.object({
  company_name: z.string().trim().max(200),
  product: z.string().trim().max(1000),
  geography: z.string().trim().max(200),
  customers: z.string().trim().max(1000),
  booking_url: z.string().trim().max(2048)
    .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), "Booking URL must start with https://"),
  setup_complete: z.boolean()
}).partial();

// sales_objective is fixed by product decision: "Book qualified discovery conversations"
r.get("/", wrap(async (req, res) => {
  const startup = ok(await db.from("startups").select("*").eq("id", req.user.startupId).single());
  const sub = ok(await db.from("subscriptions").select("*, plans(*)")
    .eq("startup_id", req.user.startupId).order("created_at", { ascending: false }).limit(1).maybeSingle());
  res.json({ startup, subscription: sub });
}));

r.patch("/", wrap(async (req, res) => {
  const d = parse(patchSchema, req.body);
  if (d.booking_url === "") d.booking_url = null;
  const startup = ok(await db.from("startups").update(d).eq("id", req.user.startupId).select().single());
  res.json({ startup });
}));

export default r;
