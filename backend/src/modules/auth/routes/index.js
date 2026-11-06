import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, audit } from "../../../infrastructure/database/supabase.js";
import { signToken, requireAuth } from "../../../core/middleware/auth.js";
import { wrap, parse, ok, HttpError } from "../../../shared/helpers.js";

const r = Router();
const pub = (u) => ({ id: u.id, startupId: u.startup_id, name: u.name, email: u.email, role: u.role });

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128)
});
const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128)
});

r.post("/register", wrap(async (req, res) => {
  const { name, email, password } = parse(registerSchema, req.body);

  const password_hash = await bcrypt.hash(password, 12);
  const endsAt = new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString();
  // One Postgres function call = one transaction. The function creates tenant, user and trial atomically.
  const created = ok(await db.rpc("register_startup_user", {
    p_name: name, p_email: email, p_password_hash: password_hash, p_trial_ends_at: endsAt
  }), "Could not create account");
  const user = Array.isArray(created) ? created[0] : created;
  if (!user) throw new HttpError(500, "Account registration returned no user", undefined, "REGISTRATION_FAILED");
  audit(user.id, "auth.register", { startup_id: user.startup_id });
  res.status(201).json({ token: signToken(user), user: pub(user) });
}));

r.post("/login", wrap(async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = ok(await db.from("users").select("*").eq("email", email).maybeSingle());
  const good = user && (await bcrypt.compare(password, user.password_hash));
  if (!good) throw new HttpError(401, "Invalid email or password");
  ok(await db.from("users").update({ last_login_at: new Date().toISOString() }).eq("id", user.id));
  audit(user.id, "auth.login");
  res.json({ token: signToken(user), user: pub(user) });
}));

r.get("/me", requireAuth, wrap(async (req, res) => {
  const user = ok(await db.from("users").select("*").eq("id", req.user.id).maybeSingle());
  if (!user) throw new HttpError(401, "User no longer exists");
  res.json({ user: pub(user) });
}));

export default r;
