import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character ObjectId');
export const messageIdParamsSchema = z.object({ id: objectId }).strict();
export const draftMessageSchema = z.object({
  campaignId: objectId,
  decisionMakerId: objectId,
  step: z.number().int().min(1).max(5).default(1),
  regenerate: z.boolean().default(false),
}).strict();
export const listMessagesQuerySchema = z.object({
  campaignId: objectId.optional(),
  prospectId: objectId.optional(),
  decisionMakerId: objectId.optional(),
  approvalStatus: z.enum(['pending', 'approved', 'rejected', 'revision_requested']).optional(),
  status: z.enum(['draft', 'ready', 'handed_off', 'user_reported_sent', 'cancelled']).optional(),
  sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export const editMessageSchema = z.object({
  subject: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
}).strict().refine(value => value.subject !== undefined || value.body !== undefined, {
  message: 'At least one of subject or body must be provided.',
});
export const rejectMessageSchema = z.object({ reason: z.string().trim().max(300).optional() }).strict();
export const requestRevisionSchema = z.object({ note: z.string().trim().min(1).max(500) }).strict();
export const markSentSchema = z.object({
  sentAt: z.string().datetime({ offset: true }).optional().transform(value => value === undefined ? undefined : new Date(value)),
}).strict();
export const noBodySchema = z.object({}).strict();
