import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character ObjectId');

export const scoreManySchema = z.object({
  prospectIds: z.array(objectId).min(1).max(50),
  icpId: objectId,
}).strict();

export const scoreParamsSchema = z.object({
  id: objectId,
}).strict();

export const scoreHistoryQuerySchema = z.object({
  icpId: objectId.optional(),
  history: z.enum(['true', 'false']).default('false'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
