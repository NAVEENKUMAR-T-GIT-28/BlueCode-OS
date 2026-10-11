import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import { createIcp, listIcps, getIcp, updateIcp, archiveIcp, proposeIcp } from '../controllers/icp.controller.js';
import { createIcpSchema, updateIcpSchema, listIcpsQuerySchema } from '../validators/icp.validator.js';
import { icpProposalInputSchema } from '../validators/icp-proposal.validator.js';

const router = Router();

function validate(schema: z.ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'query') {
      // Express 4's query object is mutable; copy parsed/coerced defaults for controller use.
      for (const [key, value] of Object.entries(parsed.data)) req.query[key] = String(value);
    } else Object.assign(req.params, parsed.data);
    next();
  };
}

const idSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();
router.use(authenticate, requireTenant);
router.post('/propose', requirePermission('icp:write'), validate(icpProposalInputSchema), proposeIcp);
router.post('/', requirePermission('icp:write'), validate(createIcpSchema), createIcp);
router.get('/', requirePermission('workspace:read'), validate(listIcpsQuerySchema, 'query'), listIcps);
router.get('/:id', requirePermission('workspace:read'), validate(idSchema, 'params'), getIcp);
router.patch('/:id', requirePermission('icp:write'), validate(idSchema, 'params'), validate(updateIcpSchema), updateIcp);
router.post('/:id/archive', requirePermission('icp:write'), validate(idSchema, 'params'), archiveIcp);

export default router;
