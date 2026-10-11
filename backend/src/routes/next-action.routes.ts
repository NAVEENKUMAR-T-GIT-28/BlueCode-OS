import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { acceptNextAction, completeNextAction, dismissNextAction, listNextActions } from '../controllers/next-action.controller.js';
import { dismissNextActionSchema, nextActionIdParamsSchema, nextActionListQuerySchema, nextActionNoBodySchema } from '../validators/next-action.validator.js';

const router = Router();
function validate(schema: z.ZodTypeAny, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(source === 'body' ? (req.body ?? {}) : req[source]);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'params') Object.assign(req.params, parsed.data);
    else for (const [key, value] of Object.entries(parsed.data)) if (value !== undefined) req.query[key] = String(value);
    next();
  };
}
router.use(authenticate, requireTenant);
router.get('/', requirePermission('workspace:read'), validate(nextActionListQuerySchema, 'query'), listNextActions);
router.post('/:id/accept', requirePermission('nba:act'), validate(nextActionIdParamsSchema, 'params'), validate(nextActionNoBodySchema), acceptNextAction);
router.post('/:id/dismiss', requirePermission('nba:act'), validate(nextActionIdParamsSchema, 'params'), validate(dismissNextActionSchema), dismissNextAction);
router.post('/:id/complete', requirePermission('nba:act'), validate(nextActionIdParamsSchema, 'params'), validate(nextActionNoBodySchema), completeNextAction);
export default router;
