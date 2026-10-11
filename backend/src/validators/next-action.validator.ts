import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a 24-character ObjectId');

export const nextActionListQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'dismissed', 'completed', 'expired']).default('pending'),
  prospectId: objectId.optional(),
  sort: z.enum(['priority']).default('priority'),
}).strict();

export const nextActionIdParamsSchema = z.object({ id: objectId }).strict();
export const nextActionNoBodySchema = z.object({}).strict();
export const dismissNextActionSchema = z.object({ reason: z.string().trim().max(200).optional() }).strict();
