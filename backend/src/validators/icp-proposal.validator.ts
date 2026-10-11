import { z } from 'zod';
import { icpCriteriaSchema } from './icp.validator.js';

export const icpProposalInputSchema = z.object({
  productDescription: z.string().trim().min(20).max(2000),
  targetGeography: z.string().trim().optional(),
  salesObjective: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).strict();

export type IcpProposalInput = z.infer<typeof icpProposalInputSchema>;

const insufficientDataSchema = z.object({
  insufficient_data: z.literal(true),
  missing: z.array(z.string().trim().min(1).max(200)).max(5),
}).strict();

const proposalSchema = z.object({
  criteria: icpCriteriaSchema,
  rationale: z.string().trim().min(1).max(400),
}).strict();

export const icpExtractOutputSchema = z.union([proposalSchema, insufficientDataSchema]);
export type IcpExtractOutput = z.infer<typeof icpExtractOutputSchema>;

/** Enforce task semantics beyond the structural Zod schema. */
export function validateIcpExtractSemantics(output: IcpExtractOutput, input: IcpProposalInput): void {
  if ('insufficient_data' in output) return;

  const criteria = output.criteria;
  if (!criteria.industries?.length && !criteria.targetJobTitles?.length) {
    throw new Error('At least one of industries or targetJobTitles must be present.');
  }

  for (const range of criteria.employeeRanges ?? []) {
    const match = /^(\d+)(?:-(\d+)|(\+))$/.exec(range);
    if (!match) throw new Error('employeeRanges values must match min-max or min+.');
    if (match[2] !== undefined && Number(match[1]) > Number(match[2])) {
      throw new Error('employeeRanges minimum must not exceed maximum.');
    }
    if (!Number.isSafeInteger(Number(match[1])) || (match[2] !== undefined && !Number.isSafeInteger(Number(match[2])))) {
      throw new Error('employeeRanges values must be safe integers.');
    }
  }

  const hasExclusions = Boolean(criteria.excludedIndustries?.length || criteria.excludedCompanies?.length);
  const sourceText = [input.productDescription, input.targetGeography, input.salesObjective, input.notes]
    .filter((value): value is string => Boolean(value))
    .join('\n');
  const explicitlyMentionsExclusions = /\b(exclud\w*|avoid|do not target|don't target|not target|leave out)\b/i.test(sourceText);
  if (hasExclusions && !explicitlyMentionsExclusions) {
    throw new Error('Exclusion criteria must be grounded in an explicit founder instruction.');
  }

  // The AI design document references a supported-country allowlist but does not define it.
  // Live LLM mode remains disabled until that allowlist and its validation are approved.
  if (criteria.countries?.length) {
    throw new Error('Country criteria cannot be accepted until the supported-country allowlist is defined.');
  }
}
