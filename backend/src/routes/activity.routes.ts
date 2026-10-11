import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { listActivities, logReply } from '../controllers/activity.controller.js';
import { activityListQuerySchema, replyLogSchema } from '../validators/activity.validator.js';

const router = Router();
function validate(schema: z.ZodTypeAny, source: 'body' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(source === 'body' ? (req.body ?? {}) : req.query);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) req.query[key] = Array.isArray(value) ? value.join(',') : String(value);
    }
    next();
  };
}
router.use(authenticate, requireTenant);
router.get('/', requirePermission('workspace:read'), validate(activityListQuerySchema, 'query'), listActivities);
router.post('/replies', requirePermission('activity:log'), validate(replyLogSchema), logReply);
export default router;
