import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Expected a 24-character ObjectId');
const activityTypes = [
  'prospect_discovered', 'contact_added', 'contact_enriched', 'score_updated', 'signal_detected',
  'message_approved', 'handoff_requested', 'message_user_reported_sent', 'reply_logged',
  'reply_classified', 'status_changed', 'integration_error',
] as const;

export const replyLogSchema = z.object({
  prospectId: objectId,
  messageId: objectId.optional(),
  text: z.string().trim().min(1).max(5000),
}).strict();

export const activityListQuerySchema = z.object({
  prospectId: objectId.optional(),
  messageId: objectId.optional(),
  type: z.string().optional().transform(value => value === undefined ? undefined : value.split(',').map(item => item.trim()).filter(Boolean))
    .refine(value => value === undefined || (value.length > 0 && value.every(item => (activityTypes as readonly string[]).includes(item))), 'Invalid activity type'),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  sort: z.enum(['-occurredAt', 'occurredAt']).default('-occurredAt'),
}).strict().superRefine((value, ctx) => {
  if (value.from && value.to && Date.parse(value.from) > Date.parse(value.to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to must be greater than or equal to from' });
  }
});
