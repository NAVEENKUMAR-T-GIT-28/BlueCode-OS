import { z } from 'zod';

export const usageRecordsQuerySchema = z.object({
  provider: z.enum(['apollo', 'llm']).optional(),
  operation: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['success', 'failed', 'blocked']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((value, context) => {
  if (value.from && value.to && value.from.getTime() > value.to.getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['from'],
      message: 'from must be earlier than or equal to to',
    });
  }
});
