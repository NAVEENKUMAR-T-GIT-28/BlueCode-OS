import { describe, expect, it } from 'vitest';
import {
  searchProspectsSchema, listProspectsQuerySchema, selectProspectsSchema,
  prospectReasonSchema, clearDoNotContactSchema,
} from '../src/validators/prospect.validator.js';

describe('Prospect request validation', () => {
  it('validates search pagination and caps provider page size at 25', () => {
    expect(searchProspectsSchema.safeParse({ icpId: '507f1f77bcf86cd799439011' }).success).toBe(true);
    expect(searchProspectsSchema.safeParse({ icpId: '507f1f77bcf86cd799439011', perPage: 26 }).success).toBe(false);
  });
  it('parses category filtering and pagination defaults', () => {
    const value = listProspectsQuerySchema.parse({ category: 'hot,high', page: '2', limit: '10' });
    expect(value.category).toEqual(['hot', 'high']);
    expect(value.page).toBe(2);
    expect(value.limit).toBe(10);
    expect(value.includeLow).toBe(false);
  });
  it('rejects unknown filters, invalid categories, and malformed IDs', () => {
    expect(listProspectsQuerySchema.safeParse({ startupId: 'other-tenant' }).success).toBe(false);
    expect(listProspectsQuerySchema.safeParse({ category: 'wildcard' }).success).toBe(false);
    expect(listProspectsQuerySchema.safeParse({ icpId: 'bad' }).success).toBe(false);
  });
  it('caps bulk selection at 50 IDs and rejects empty arrays', () => {
    expect(selectProspectsSchema.safeParse({ prospectIds: ['507f1f77bcf86cd799439011'] }).success).toBe(true);
    expect(selectProspectsSchema.safeParse({ prospectIds: [] }).success).toBe(false);
    expect(selectProspectsSchema.safeParse({ prospectIds: Array(51).fill('507f1f77bcf86cd799439011') }).success).toBe(false);
  });
  it('requires a reason to clear DNC', () => {
    expect(clearDoNotContactSchema.safeParse({ reason: 'Confirmed the contact opted back in.' }).success).toBe(true);
    expect(clearDoNotContactSchema.safeParse({ reason: 'no' }).success).toBe(false);
    expect(clearDoNotContactSchema.safeParse({}).success).toBe(false);
  });
  it('allows an optional bounded reason on other status actions', () => {
    expect(prospectReasonSchema.safeParse({}).success).toBe(true);
    expect(prospectReasonSchema.safeParse({ reason: 'manual review' }).success).toBe(true);
    expect(prospectReasonSchema.safeParse({ extra: true }).success).toBe(false);
  });
});
