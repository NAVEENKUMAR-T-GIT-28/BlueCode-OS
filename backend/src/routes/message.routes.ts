import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  draftMessage, listMessages, getMessage, editMessage, approveMessage, rejectMessage,
  requestMessageRevision, handoffMessage, markMessageSent, cancelMessage,
} from '../controllers/message.controller.js';
import {
  draftMessageSchema, editMessageSchema, listMessagesQuerySchema, markSentSchema,
  messageIdParamsSchema, noBodySchema, rejectMessageSchema, requestRevisionSchema,
} from '../validators/message.validator.js';

const router = Router();
function validate(schema: z.ZodTypeAny, source: 'body' | 'params' | 'query' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(source === 'body' ? (req.body ?? {}) : req[source]);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else if (source === 'params') Object.assign(req.params, parsed.data);
    else for (const [key, value] of Object.entries(parsed.data)) { if (value !== undefined) req.query[key] = String(value); }
    next();
  };
}

router.use(authenticate, requireTenant);
router.post('/draft', requirePermission('message:draft'), validate(draftMessageSchema), draftMessage);
router.get('/', requirePermission('workspace:read'), validate(listMessagesQuerySchema, 'query'), listMessages);
router.get('/:id', requirePermission('workspace:read'), validate(messageIdParamsSchema, 'params'), getMessage);
router.patch('/:id', requirePermission('message:edit'), validate(messageIdParamsSchema, 'params'), validate(editMessageSchema), editMessage);
router.post('/:id/approve', requirePermission('message:approve'), validate(messageIdParamsSchema, 'params'), validate(noBodySchema), approveMessage);
router.post('/:id/reject', requirePermission('message:approve'), validate(messageIdParamsSchema, 'params'), validate(rejectMessageSchema), rejectMessage);
router.post('/:id/request-revision', requirePermission('message:approve'), validate(messageIdParamsSchema, 'params'), validate(requestRevisionSchema), requestMessageRevision);
router.post('/:id/handoff', requirePermission('message:handoff'), validate(messageIdParamsSchema, 'params'), validate(noBodySchema), handoffMessage);
router.post('/:id/mark-sent', requirePermission('message:handoff'), validate(messageIdParamsSchema, 'params'), validate(markSentSchema), markMessageSent);
router.post('/:id/cancel', requirePermission('message:edit'), validate(messageIdParamsSchema, 'params'), validate(noBodySchema), cancelMessage);
export default router;
