import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  searchProspects, listProspects, getProspect, selectProspects,
  disqualifyProspect, markProspectDoNotContact, clearProspectDoNotContact,
} from '../controllers/prospect.controller.js';
import {
  searchProspectsSchema, listProspectsQuerySchema, selectProspectsSchema,
  prospectReasonSchema, clearDoNotContactSchema,
} from '../validators/prospect.validator.js';

const router = Router();
const idParamsSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) }).strict();

function validate(schema: z.ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const input = source === 'body' ? (req.body ?? {}) : req[source];
    const parsed = schema.safeParse(input);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'query') {
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) req.query[key] = Array.isArray(value) ? value.join(',') : String(value);
      }
    } else Object.assign(req.params, parsed.data);
    next();
  };
}

router.use(authenticate, requireTenant);
router.post('/search', requirePermission('prospect:search'), validate(searchProspectsSchema), searchProspects);
router.get('/', requirePermission('workspace:read'), validate(listProspectsQuerySchema, 'query'), listProspects);
router.post('/select', requirePermission('prospect:search'), validate(selectProspectsSchema), selectProspects);
router.get('/:id', requirePermission('workspace:read'), validate(idParamsSchema, 'params'), getProspect);
router.post('/:id/disqualify', requirePermission('prospect:search'), validate(idParamsSchema, 'params'), validate(prospectReasonSchema), disqualifyProspect);
router.post('/:id/do-not-contact', requirePermission('prospect:mark_dnc'), validate(idParamsSchema, 'params'), validate(prospectReasonSchema), markProspectDoNotContact);
router.post('/:id/clear-do-not-contact', requirePermission('prospect:clear_dnc'), validate(idParamsSchema, 'params'), validate(clearDoNotContactSchema), clearProspectDoNotContact);

export default router;
