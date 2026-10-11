import { z } from 'zod';

const settingsPatchSchema = z.object({
  calendarLink: z.string().trim().url().max(200)
    .refine(value => new URL(value).protocol === 'https:', 'calendarLink must use HTTPS')
    .optional(),
  senderName: z.string().trim().min(1).max(200).optional(),
  senderTitle: z.string().trim().min(1).max(200).optional(),
  productSummary: z.string().trim().min(1).max(1000).optional(),
}).strict().refine(value => Object.values(value).some(item => item !== undefined), {
  message: 'At least one settings field must be provided.',
});

export const updateStartupSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  settings: settingsPatchSchema.optional(),
}).strict().refine(value => value.name !== undefined || value.settings !== undefined, {
  message: 'At least one of name or settings must be provided.',
});

export const inviteMemberSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(['admin', 'member']),
}).strict();

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
}).strict();

export const memberIdParamsSchema = z.object({
  memberId: z.string().regex(/^[a-f\d]{24}$/i, 'memberId must be a 24-character ObjectId'),
}).strict();
