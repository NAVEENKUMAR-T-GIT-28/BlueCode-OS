export type ScoreCategory = 'hot' | 'high' | 'medium' | 'low';

export interface ScoreCriteria {
  industries?: string[];
  employeeRanges?: string[];
  countries?: string[];
  regions?: string[];
  technologies?: string[];
  companyKeywords?: string[];
  targetJobTitles?: string[];
}

export interface ScoreFirmographics {
  industry?: string;
  employeeCount?: number;
  country?: string;
  region?: string;
  technologies?: string[];
  keywords?: string[];
}

export interface DeterministicScoreInput {
  firmographics?: ScoreFirmographics;
  criteria: ScoreCriteria;
  contactJobTitles: string[];
  activeSignalCount: number;
}

export interface DeterministicScore {
  score: number;
  category: ScoreCategory;
  coverage: number;
  breakdown: Record<string, number>;
  explanation: string;
  scoringVersion: 'deterministic-v1';
}

const WEIGHTS = {
  industry: 25,
  employeeRange: 20,
  geography: 15,
  technology: 10,
  keywords: 10,
  contactAvailability: 10,
  evidenceBackedSignal: 10,
} as const;

const normalize = (value: string): string => value.trim().toLocaleLowerCase('en');
const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const hasValues = (value: unknown): value is string[] => Array.isArray(value) && value.some(nonEmpty);

function matchesAny(value: string, candidates: string[]): boolean {
  const target = normalize(value);
  return candidates.some(candidate => nonEmpty(candidate) && normalize(candidate) === target);
}

function intersects(values: string[], candidates: string[]): boolean {
  const known = new Set(candidates.filter(nonEmpty).map(normalize));
  return values.some(value => nonEmpty(value) && known.has(normalize(value)));
}

/** Parse common, explicit employee range labels without guessing unknown formats. */
export function parseEmployeeRange(label: string): { min: number; max: number } | undefined {
  const text = label.trim().toLowerCase().replace(/employees?/g, '').replace(/,/g, '').trim();
  const open = text.match(/^(\d+)\s*\+$/);
  if (open) return { min: Number(open[1]), max: Number.POSITIVE_INFINITY };
  const range = text.match(/^(\d+)\s*(?:-|–|—|to)\s*(\d+)$/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (Number.isSafeInteger(min) && Number.isSafeInteger(max) && min >= 0 && max >= min) return { min, max };
  }
  return undefined;
}

function categoryFor(score: number, coverage: number): ScoreCategory {
  let category: ScoreCategory = score >= 90 ? 'hot' : score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low';
  if (coverage < 0.5 && (category === 'hot' || category === 'high')) category = 'medium';
  return category;
}

/**
 * Pure deterministic scoring. Missing comparison inputs are excluded from available weight;
 * the score is rescaled over available weight, while coverage reports available/100.
 */
export function scoreDeterministic(input: DeterministicScoreInput): DeterministicScore {
  const firmographics = input.firmographics ?? {};
  const criteria = input.criteria;
  const breakdown: Record<string, number> = {};
  let availableWeight = 0;
  let earned = 0;

  const add = (key: keyof typeof WEIGHTS, points: number) => {
    availableWeight += WEIGHTS[key];
    earned += points;
    breakdown[key] = points;
  };

  if (nonEmpty(firmographics.industry) && hasValues(criteria.industries)) {
    add('industry', matchesAny(firmographics.industry, criteria.industries) ? WEIGHTS.industry : 0);
  }

  const parsedRanges = (criteria.employeeRanges ?? []).map(parseEmployeeRange).filter(
    (range): range is { min: number; max: number } => range !== undefined,
  );
  if (Number.isSafeInteger(firmographics.employeeCount) && (firmographics.employeeCount ?? -1) >= 0 && parsedRanges.length > 0) {
    const count = firmographics.employeeCount!;
    add('employeeRange', parsedRanges.some(range => count >= range.min && count <= range.max) ? WEIGHTS.employeeRange : 0);
  }

  const geoChecks: boolean[] = [];
  if (nonEmpty(firmographics.country) && hasValues(criteria.countries)) {
    geoChecks.push(matchesAny(firmographics.country, criteria.countries));
  }
  if (nonEmpty(firmographics.region) && hasValues(criteria.regions)) {
    geoChecks.push(matchesAny(firmographics.region, criteria.regions));
  }
  if (geoChecks.length > 0) add('geography', geoChecks.some(Boolean) ? WEIGHTS.geography : 0);

  if (hasValues(firmographics.technologies) && hasValues(criteria.technologies)) {
    add('technology', intersects(firmographics.technologies, criteria.technologies) ? WEIGHTS.technology : 0);
  }

  if (hasValues(firmographics.keywords) && hasValues(criteria.companyKeywords)) {
    add('keywords', intersects(firmographics.keywords, criteria.companyKeywords) ? WEIGHTS.keywords : 0);
  }

  if (hasValues(criteria.targetJobTitles)) {
    add('contactAvailability', intersects(input.contactJobTitles, criteria.targetJobTitles) ? WEIGHTS.contactAvailability : 0);
  }

  // No active signal means no evidence-backed signal input to score, so this component is absent.
  const activeSignalCount = Number.isSafeInteger(input.activeSignalCount) ? Math.max(0, input.activeSignalCount) : 0;
  if (activeSignalCount > 0) add('evidenceBackedSignal', Math.min(activeSignalCount, WEIGHTS.evidenceBackedSignal));

  const coverage = availableWeight / 100;
  const score = availableWeight === 0 ? 0 : Math.max(0, Math.min(100, Math.round((100 * earned) / availableWeight)));
  const category = categoryFor(score, coverage);
  const parts = Object.entries(breakdown).map(([key, points]) => `${key} ${points}/${WEIGHTS[key as keyof typeof WEIGHTS]}`);
  const explanation = parts.length
    ? `Deterministic v1: ${parts.join('; ')}. Coverage ${(coverage * 100).toFixed(0)}%. Score is a rules-based estimate, not a prediction.`
    : 'Insufficient matching data to evaluate this prospect against this ICP. Coverage 0%. Score is a rules-based estimate, not a prediction.';

  return { score, category, coverage, breakdown, explanation: explanation.slice(0, 2000), scoringVersion: 'deterministic-v1' };
}
