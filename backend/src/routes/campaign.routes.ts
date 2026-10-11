import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/authenticate.js';
import { requireTenant } from '../middleware/require-tenant.js';
import { requirePermission } from '../middleware/require-permission.js';
import {
  createCampaign, listCampaigns, getCampaign, updateCampaign, submitCampaign,
  approveCampaign, pauseCampaign, resumeCampaign, completeCampaign, cancelCampaign,
} from '../controllers/campaign.controller.js';
import { campaignIdParamsSchema, createCampaignSchema, listCampaignsQuerySchema, noBodySchema, updateCampaignSchema } from '../validators/campaign.validator.js';

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
router.post('/', requirePermission('message:draft'), validate(createCampaignSchema), createCampaign);
router.get('/', requirePermission('workspace:read'), validate(listCampaignsQuerySchema, 'query'), listCampaigns);
router.get('/:id', requirePermission('workspace:read'), validate(campaignIdParamsSchema, 'params'), getCampaign);
router.patch('/:id', requirePermission('message:draft'), validate(campaignIdParamsSchema, 'params'), validate(updateCampaignSchema), updateCampaign);
router.post('/:id/submit', requirePermission('message:draft'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), submitCampaign);
router.post('/:id/approve', requirePermission('campaign:approve'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), approveCampaign);
router.post('/:id/pause', requirePermission('campaign:approve'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), pauseCampaign);
router.post('/:id/resume', requirePermission('campaign:approve'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), resumeCampaign);
router.post('/:id/complete', requirePermission('campaign:approve'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), completeCampaign);
router.post('/:id/cancel', requirePermission('campaign:approve'), validate(campaignIdParamsSchema, 'params'), validate(noBodySchema), cancelCampaign);
export default router;
