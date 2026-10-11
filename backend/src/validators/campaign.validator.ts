import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character ObjectId');
export const campaignIdParamsSchema = z.object({ id: objectId }).strict();
export const createCampaignSchema = z.object({
  icpId: objectId,
  name: z.string().trim().min(1).max(80),
  channel: z.literal('email'),
}).strict();
export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
}).strict().refine(value => value.name !== undefined, { message: 'name is required' });
export const listCampaignsQuerySchema = z.object({
  status: z.enum(['draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'cancelled']).optional(),
  sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const noBodySchema = z.object({}).strict();
