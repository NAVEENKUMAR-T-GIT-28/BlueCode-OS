import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { getDashboard } from '../controllers/dashboard.controller.js';
import { dashboardQuerySchema } from '../validators/dashboard.validator.js';

const router = Router();
router.use(authenticate, requireTenant);
router.get('/', requirePermission('workspace:read'), (req: Request, _res: Response, next: NextFunction) => {
  const parsed = dashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) return next(parsed.error);
  next();
}, getDashboard);
export default router;
