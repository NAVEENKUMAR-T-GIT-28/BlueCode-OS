import { Router } from "express";
import { requireAuth } from "../../../core/middleware/auth.js";

// Out of scope for this phase; routes exist so the frontend contract stays stable.
const r = Router();
r.use(requireAuth);
const notImpl = (what) => (_req, res) =>
  res.status(501).json({ error: `${what} is not implemented in the internal MVP backend` });

r.get("/integrations/status", (_req, res) => res.json({
  ai: { configured: false }, hunter: { centrallyManaged: true, configured: false },
  email: { configured: false }, payments: { configured: false }
}));
r.all("/hunter/*", notImpl("Hunter integration"));
r.all("/ai/*", notImpl("AI (OpenRouter) integration"));
r.all("/email/*", notImpl("Email"));
r.all("/payments/*", notImpl("Payments"));
export default r;
