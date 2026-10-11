import { describe, expect, it } from 'vitest';
import { getDefaultCostType, getUsageEstimate } from '../src/config/usage-estimates.js';
import {
  assertNonNegativeIntegerPaise, assertPositiveIntegerPaise,
  isProviderOutcomeUnknown, remainingPaise, sanitizeErrorCode,
} from '../src/utils/usage-domain.js';

describe('Usage domain rules', () => {
  it('requires a positive integer estimate in paise', () => {
    expect(() => assertPositiveIntegerPaise(1)).not.toThrow();
    expect(() => assertPositiveIntegerPaise(0)).toThrow();
    expect(() => assertPositiveIntegerPaise(1.5)).toThrow();
    expect(() => assertPositiveIntegerPaise(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it('allows zero actual charge while requiring integer paise', () => {
    expect(() => assertNonNegativeIntegerPaise(0)).not.toThrow();
    expect(() => assertNonNegativeIntegerPaise(3)).not.toThrow();
    expect(() => assertNonNegativeIntegerPaise(-1)).toThrow();
    expect(() => assertNonNegativeIntegerPaise(2.5)).toThrow();
  });

  it('never returns negative spend remaining after an allowed overrun', () => {
    expect(remainingPaise(1000, 300, 200)).toBe(500);
    expect(remainingPaise(1000, 1200, 0)).toBe(0);
  });

  it('labels costs as reported only when the provider reports them', () => {
    expect(getDefaultCostType(false)).toBe('estimated');
    expect(getDefaultCostType(true)).toBe('reported');
  });

  it('fails closed when an operation has no approved estimate', () => {
    expect(() => getUsageEstimate('apollo.org_search')).toThrow();
  });

  it('recognizes unknown provider outcomes without exposing provider messages', () => {
    expect(isProviderOutcomeUnknown({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isProviderOutcomeUnknown({ unknownOutcome: true })).toBe(true);
    expect(isProviderOutcomeUnknown(new Error('bad input'))).toBe(false);
    expect(sanitizeErrorCode({ code: 'ECONNRESET' })).toBe('ECONNRESET');
    expect(sanitizeErrorCode(new Error('secret text'))).toBe('PROVIDER_FAILED');
  });
});
