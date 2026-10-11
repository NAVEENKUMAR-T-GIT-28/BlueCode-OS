import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character ObjectId');

export const prospectIdParamsSchema = z.object({ id: objectId }).strict();
export const signalIdParamsSchema = z.object({ id: objectId }).strict();
export const decisionMakerIdParamsSchema = z.object({ id: objectId }).strict();

export const listSignalsQuerySchema = z.object({
  status: z.enum(['active', 'dismissed', 'stale']).optional(),
}).strict();

const httpUrl = z.string().trim().url().max(300).refine(value => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'URL must use HTTP or HTTPS');

export const addDecisionMakerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().min(1).max(120).optional(),
  businessEmail: z.string().trim().email().max(254),
  linkedinUrl: httpUrl.optional(),
}).strict();

export const noBodySchema = z.object({}).strict();
