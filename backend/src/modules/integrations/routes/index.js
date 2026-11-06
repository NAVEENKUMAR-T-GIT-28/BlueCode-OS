import { Router } from "express";
import { requireAuth } from "../../../core/middleware/auth.js";
import { HttpError } from "../../../core/errors/HttpError.js";

// Out of scope for this phase; routes exist so the frontend contract stays stable.
const r = Router();
const notImpl = (what) => (_req, _res, next) =>
  next(new HttpError(501, `${what} is not implemented in the internal MVP backend`, undefined, "NOT_IMPLEMENTED"));

r.get("/integrations/status", requireAuth, (_req, res) => res.json({
  ai: { configured: false }, hunter: { centrallyManaged: true, configured: false },
  email: { configured: false }, payments: { configured: false }
}));
r.all("/hunter/*", requireAuth, notImpl("Hunter integration"));
r.all("/ai/*", requireAuth, notImpl("AI (OpenRouter) integration"));
r.all("/email/*", requireAuth, notImpl("Email"));
r.all("/payments/*", requireAuth, notImpl("Payments"));
export default r;
