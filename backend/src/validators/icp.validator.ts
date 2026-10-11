import { z } from 'zod';

const criteriaKeys = [
  'industries', 'countries', 'regions', 'employeeRanges', 'revenueRanges', 'technologies',
  'companyKeywords', 'excludedIndustries', 'excludedCompanies', 'targetJobTitles',
  'targetSeniority', 'contactLocations',
] as const;

const criteriaField = z.array(z.string().trim().min(1).max(80)).max(25).optional();

export const icpCriteriaSchema = z.object({
  industries: criteriaField,
  countries: criteriaField,
  regions: criteriaField,
  employeeRanges: criteriaField,
  revenueRanges: criteriaField,
  technologies: criteriaField,
  companyKeywords: criteriaField,
  excludedIndustries: criteriaField,
  excludedCompanies: criteriaField,
  targetJobTitles: criteriaField,
  targetSeniority: criteriaField,
  contactLocations: criteriaField,
}).strict().superRefine((criteria, context) => {
  for (const key of criteriaKeys) {
    const values = criteria[key];
    if (!values) continue;
    if (new Set(values.map(value => value.toLocaleLowerCase('en'))).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: 'Duplicate values are not allowed in the same criteria array.',
      });
    }
  }
});

export const createIcpSchema = z.object({
  name: z.string().trim().min(1).max(80),
  criteria: icpCriteriaSchema,
}).strict();

export const updateIcpSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  criteria: icpCriteriaSchema.optional(),
}).strict().refine(value => value.name !== undefined || value.criteria !== undefined, {
  message: 'At least one of name or criteria must be provided.',
});

export const listIcpsQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
  sort: z.enum(['createdAt', '-createdAt']).default('-createdAt'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
