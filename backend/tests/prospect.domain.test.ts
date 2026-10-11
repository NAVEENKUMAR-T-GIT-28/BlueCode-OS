import { describe, expect, it } from 'vitest';
import { normalizeDomain } from '../src/utils/normalize-domain.js';

describe('normalizeDomain', () => {
  it('normalizes scheme, path, www prefix, case, and trailing slash', () => {
    expect(normalizeDomain(' HTTPS://WWW.Acme.com/company/ ')).toBe('acme.com');
  });
  it('normalizes a bare domain and port', () => {
    expect(normalizeDomain('acme.com:443')).toBe('acme.com');
  });
  it('does not guess invalid or empty domains', () => {
    expect(normalizeDomain('')).toBeUndefined();
    expect(normalizeDomain('not a domain')).toBeUndefined();
    expect(normalizeDomain(undefined)).toBeUndefined();
  });
});
