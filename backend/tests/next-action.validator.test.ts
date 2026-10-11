import { describe, expect, it } from 'vitest';
import { dismissNextActionSchema, nextActionIdParamsSchema, nextActionListQuerySchema, nextActionNoBodySchema } from '../src/validators/next-action.validator.js';

describe('M6 next-action validators', () => {
  it('defaults the list to pending priority order', () => {
    expect(nextActionListQuerySchema.parse({})).toEqual({ status: 'pending', sort: 'priority' });
  });
  it('accepts derived expired as a read filter', () => {
    expect(nextActionListQuerySchema.safeParse({ status: 'expired' }).success).toBe(true);
  });
  it('rejects invalid action IDs', () => {
    expect(nextActionIdParamsSchema.safeParse({ id: 'not-an-id' }).success).toBe(false);
  });
  it('accepts an optional bounded dismissal reason without unknown fields', () => {
    expect(dismissNextActionSchema.safeParse({ reason: 'No longer relevant' }).success).toBe(true);
    expect(dismissNextActionSchema.safeParse({ reason: 'x'.repeat(201) }).success).toBe(false);
    expect(dismissNextActionSchema.safeParse({ reason: 'ok', startupId: 'x' }).success).toBe(false);
  });
  it('accepts only empty action bodies for accept and complete', () => {
    expect(nextActionNoBodySchema.safeParse({}).success).toBe(true);
    expect(nextActionNoBodySchema.safeParse({ status: 'accepted' }).success).toBe(false);
  });
});
