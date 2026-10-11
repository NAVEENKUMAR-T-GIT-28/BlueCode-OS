import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  createStartup, listStartups, currentStartup, updateCurrentStartup,
  listCurrentMembers, inviteCurrentMember, updateCurrentMemberRole, removeCurrentMember,
} from '../controllers/startup.controller.js';
import { createStartupSchema } from '../validators/auth.validator.js';
import {
  updateStartupSchema, inviteMemberSchema, updateMemberRoleSchema, memberIdParamsSchema,
} from '../validators/startup.validator.js';

const router = Router();

function validate(schema: z.ZodTypeAny, source: 'body' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    if (source === 'body') req.body = parsed.data;
    else Object.assign(req.params, parsed.data);
    next();
  };
}

router.get('/', authenticate, listStartups);
router.post('/', authenticate, validate(createStartupSchema), createStartup);

router.get('/current', authenticate, requireTenant, requirePermission('workspace:read'), currentStartup);
router.patch('/current', authenticate, requireTenant, requirePermission('workspace:settings'), validate(updateStartupSchema), updateCurrentStartup);

router.get('/current/members', authenticate, requireTenant, requirePermission('workspace:read'), listCurrentMembers);
router.post('/current/members', authenticate, requireTenant, requirePermission('member:invite'), validate(inviteMemberSchema), inviteCurrentMember);
router.patch('/current/members/:memberId', authenticate, requireTenant, requirePermission('member:role'), validate(memberIdParamsSchema, 'params'), validate(updateMemberRoleSchema), updateCurrentMemberRole);
router.delete('/current/members/:memberId', authenticate, requireTenant, requirePermission('member:role'), validate(memberIdParamsSchema, 'params'), removeCurrentMember);

export default router;
