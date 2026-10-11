import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  addProspectContact, listProspectContacts, searchProspectContacts, enrichContact,
  markContactDoNotContact, listProspectSignals, detectProspectSignals,
  interpretProspectSignals, dismissSignal,
} from '../controllers/contact-signal.controller.js';
import {
  addDecisionMakerSchema, decisionMakerIdParamsSchema, listSignalsQuerySchema, noBodySchema,
  prospectIdParamsSchema, signalIdParamsSchema,
} from '../validators/contact-signal.validator.js';

const router = Router();

function validate(schema: z.ZodTypeAny, source: 'body' | 'query' | 'params' = 'body') {
  return (req: import('express').Request, _res: import('express').Response, next: import('express').NextFunction) => {
    const input = source === 'body' ? (req.body ?? {}) : req[source];
    const parsed = schema.safeParse(input);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'query') {
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) req.query[key] = String(value);
      }
    } else Object.assign(req.params, parsed.data);
    next();
  };
}

// Signals
router.get('/prospects/:id/signals', authenticate, requireTenant, requirePermission('workspace:read'), validate(prospectIdParamsSchema, 'params'), validate(listSignalsQuerySchema, 'query'), listProspectSignals);
router.post('/prospects/:id/signals/detect', authenticate, requireTenant, requirePermission('prospect:score'), validate(prospectIdParamsSchema, 'params'), validate(noBodySchema), detectProspectSignals);
router.post('/prospects/:id/signals/interpret', authenticate, requireTenant, requirePermission('prospect:score'), validate(prospectIdParamsSchema, 'params'), validate(noBodySchema), interpretProspectSignals);
router.post('/signals/:id/dismiss', authenticate, requireTenant, requirePermission('prospect:score'), validate(signalIdParamsSchema, 'params'), validate(noBodySchema), dismissSignal);

// Contacts
router.get('/prospects/:id/decision-makers', authenticate, requireTenant, requirePermission('workspace:read'), validate(prospectIdParamsSchema, 'params'), listProspectContacts);
router.post('/prospects/:id/decision-makers/search', authenticate, requireTenant, requirePermission('contact:enrich'), validate(prospectIdParamsSchema, 'params'), validate(noBodySchema), searchProspectContacts);
router.post('/prospects/:id/decision-makers', authenticate, requireTenant, requirePermission('contact:enrich'), validate(prospectIdParamsSchema, 'params'), validate(addDecisionMakerSchema), addProspectContact);
router.post('/decision-makers/:id/enrich', authenticate, requireTenant, requirePermission('contact:enrich'), validate(decisionMakerIdParamsSchema, 'params'), validate(noBodySchema), enrichContact);
router.post('/decision-makers/:id/do-not-contact', authenticate, requireTenant, requirePermission('prospect:mark_dnc'), validate(decisionMakerIdParamsSchema, 'params'), validate(noBodySchema), markContactDoNotContact);

export default router;
