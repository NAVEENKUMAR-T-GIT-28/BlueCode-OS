import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { getUsageRecords, getUsageSummary } from '../controllers/usage.controller.js';
import { usageRecordsQuerySchema } from '../validators/usage.validator.js';

const router = Router();

function validateQuery(schema: z.ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return next(parsed.error);
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value === undefined) continue;
      req.query[key] = value instanceof Date ? value.toISOString() : String(value);
    }
    next();
  };
}

router.get('/summary', authenticate, requireTenant, requirePermission('workspace:read'), getUsageSummary);
router.get('/records', authenticate, requireTenant, requirePermission('workspace:read'), validateQuery(usageRecordsQuerySchema), getUsageRecords);

export default router;
