import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a 24-character ObjectId');
const statuses = ['discovered', 'qualified', 'disqualified', 'do_not_contact'] as const;
const categories = ['hot', 'high', 'medium', 'low'] as const;

export const searchProspectsSchema = z.object({
  icpId: objectId,
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(25).default(25),
}).strict();

export const listProspectsQuerySchema = z.object({
  icpId: objectId.optional(),
  scoredAgainstIcpId: objectId.optional(),
  status: z.enum(statuses).optional(),
  category: z.string().trim().min(1).optional().transform(value => value === undefined ? undefined : value.split(',').map(v => v.trim())),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  includeLow: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  sort: z.enum(['score', '-score', 'createdAt', '-createdAt', 'name']).default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((value, context) => {
  if (value.category && value.category.some(item => !categories.includes(item as typeof categories[number]))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: 'category must contain hot, high, medium, or low values separated by commas' });
  }
});

export const selectProspectsSchema = z.object({ prospectIds: z.array(objectId).min(1).max(50) }).strict();
export const prospectReasonSchema = z.object({ reason: z.string().trim().min(1).max(300).optional() }).strict();
export const clearDoNotContactSchema = z.object({ reason: z.string().trim().min(5).max(300) }).strict();
