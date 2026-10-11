import { describe, expect, it } from 'vitest';
import { parseEmployeeRange, scoreDeterministic } from '../src/services/deterministic-score.js';

describe('parseEmployeeRange', () => {
  it('parses closed ranges and open-ended ranges', () => {
    expect(parseEmployeeRange('11-50')).toEqual({ min: 11, max: 50 });
    expect(parseEmployeeRange('1,001 to 5,000 employees')).toEqual({ min: 1001, max: 5000 });
    expect(parseEmployeeRange('1000+')).toEqual({ min: 1000, max: Number.POSITIVE_INFINITY });
  });
  it('does not guess unsupported range syntax', () => {
    expect(parseEmployeeRange('large companies')).toBeUndefined();
  });
});

describe('scoreDeterministic', () => {
  it('scores matching evidence at 100 with full coverage', () => {
    const result = scoreDeterministic({
      firmographics: { industry: 'Software', employeeCount: 80, country: 'India', region: 'Tamil Nadu', technologies: ['React'], keywords: ['B2B SaaS'] },
      criteria: { industries: ['Software'], employeeRanges: ['51-200'], countries: ['India'], regions: ['Tamil Nadu'], technologies: ['React'], companyKeywords: ['B2B SaaS'], targetJobTitles: ['CTO'] },
      contactJobTitles: ['cto'], activeSignalCount: 10,
    });
    expect(result.score).toBe(100);
    expect(result.category).toBe('hot');
    expect(result.coverage).toBe(1);
    expect(Object.values(result.breakdown).reduce((sum, n) => sum + n, 0)).toBe(100);
    expect(result.scoringVersion).toBe('deterministic-v1');
  });

  it('excludes missing components from the denominator and exposes coverage', () => {
    const result = scoreDeterministic({
      firmographics: { industry: 'Software' },
      criteria: { industries: ['Software'], countries: ['India'] },
      contactJobTitles: [], activeSignalCount: 0,
    });
    expect(result.score).toBe(100);
    expect(result.coverage).toBe(0.25);
    expect(result.category).toBe('medium');
    expect(Object.keys(result.breakdown)).toEqual(['industry']);
  });

  it('scores an explicit non-match as zero points while counting its weight as available', () => {
    const result = scoreDeterministic({
      firmographics: { industry: 'Retail' },
      criteria: { industries: ['Software'] },
      contactJobTitles: [], activeSignalCount: 0,
    });
    expect(result.score).toBe(0);
    expect(result.coverage).toBe(0.25);
    expect(result.breakdown.industry).toBe(0);
    expect(result.category).toBe('low');
  });

  it('uses contact criteria as an available component even when no matching contact exists', () => {
    const result = scoreDeterministic({
      criteria: { targetJobTitles: ['Chief Technology Officer'] },
      contactJobTitles: ['Account Executive'], activeSignalCount: 0,
    });
    expect(result.coverage).toBe(0.1);
    expect(result.breakdown.contactAvailability).toBe(0);
    expect(result.score).toBe(0);
  });

  it('caps signal points at their documented component weight', () => {
    const one = scoreDeterministic({ criteria: {}, contactJobTitles: [], activeSignalCount: 1 });
    const many = scoreDeterministic({ criteria: {}, contactJobTitles: [], activeSignalCount: 99 });
    expect(one.breakdown.evidenceBackedSignal).toBe(1);
    expect(many.breakdown.evidenceBackedSignal).toBe(10);
    expect(many.coverage).toBe(0.1);
  });

  it('returns zero coverage when no criteria can be evaluated', () => {
    const result = scoreDeterministic({ criteria: {}, contactJobTitles: [], activeSignalCount: 0 });
    expect(result.score).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.category).toBe('low');
    expect(result.explanation).toContain('Insufficient matching data');
  });
});
