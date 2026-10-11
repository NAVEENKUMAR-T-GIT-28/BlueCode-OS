import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, me, logout } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { z } from 'zod';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
const validate = (schema: z.ZodTypeAny) => (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);
  req.body = parsed.data;
  next();
};
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', authenticate, me);
router.post('/logout', logout);
export default router;
