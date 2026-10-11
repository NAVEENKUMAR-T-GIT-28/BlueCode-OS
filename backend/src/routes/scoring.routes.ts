import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { scoreMany, getProspectScores } from '../controllers/scoring.controller.js';
import { scoreManySchema, scoreParamsSchema, scoreHistoryQuerySchema } from '../validators/scoring.validator.js';

const router = Router();
function validate(schema: z.ZodTypeAny, source: 'body' | 'params' | 'query') {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'params') Object.assign(req.params, parsed.data);
    else {
      const query = parsed.data as Record<string, unknown>;
      for (const [key, value] of Object.entries(query)) req.query[key] = String(value);
    }
    next();
  };
}

router.post('/prospects/score', authenticate, requireTenant, requirePermission('prospect:score'), validate(scoreManySchema, 'body'), scoreMany);
router.get('/prospects/:id/scores', authenticate, requireTenant, requirePermission('workspace:read'), validate(scoreParamsSchema, 'params'), validate(scoreHistoryQuerySchema, 'query'), getProspectScores);
export default router;
