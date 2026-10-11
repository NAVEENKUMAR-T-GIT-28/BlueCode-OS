import { describe, expect, it } from 'vitest';
import { createIcpSchema, updateIcpSchema, listIcpsQuerySchema } from '../src/validators/icp.validator.js';

describe('ICP validation', () => {
  it('accepts an ICP with empty criteria', () => {
    expect(createIcpSchema.safeParse({ name: 'B2B SaaS', criteria: {} }).success).toBe(true);
  });
  it('rejects unknown criteria and top-level fields', () => {
    expect(createIcpSchema.safeParse({ name: 'ICP', criteria: { countries: ['IN'], secret: true } }).success).toBe(false);
    expect(createIcpSchema.safeParse({ name: 'ICP', criteria: {}, startupId: 'other-tenant' }).success).toBe(false);
  });
  it('limits arrays to 25 values and 80 chars per value', () => {
    expect(createIcpSchema.safeParse({ name: 'ICP', criteria: { countries: Array(26).fill('IN') } }).success).toBe(false);
    expect(createIcpSchema.safeParse({ name: 'ICP', criteria: { countries: ['x'.repeat(81)] } }).success).toBe(false);
  });
  it('requires a field to update', () => {
    expect(updateIcpSchema.safeParse({}).success).toBe(false);
  });
  it('rejects unknown list parameters', () => {
    expect(listIcpsQuerySchema.safeParse({ sort: '-createdAt', page: '1', limit: '20' }).success).toBe(true);
    expect(listIcpsQuerySchema.safeParse({ startupId: 'other-tenant' }).success).toBe(false);
  });
});
