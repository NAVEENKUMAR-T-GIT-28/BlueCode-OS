import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { createStartup, listStartups, currentStartup } from '../controllers/startup.controller.js';
import { createStartupSchema } from '../validators/auth.validator.js';

const router = Router();
const validateCreate = (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
  const parsed = createStartupSchema.safeParse(req.body);
  if (!parsed.success) return next(parsed.error);
  req.body = parsed.data;
  next();
};
router.get('/', authenticate, listStartups);
router.post('/', authenticate, validateCreate, createStartup);
router.get('/current', authenticate, requireTenant, currentStartup);
export default router;
