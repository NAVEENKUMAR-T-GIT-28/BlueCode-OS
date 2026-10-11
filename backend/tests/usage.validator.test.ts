import { describe, expect, it } from 'vitest';
import { usageRecordsQuerySchema } from '../src/validators/usage.validator.js';

describe('Usage records query validation', () => {
  it('applies default pagination and accepts provider/status/date filters', () => {
    const parsed = usageRecordsQuerySchema.parse({
      provider: 'llm',
      status: 'failed',
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-10-11T23:59:59.000Z',
    });
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.from).toBeInstanceOf(Date);
  });

  it('rejects invalid provider, status, unknown fields and limit above 100', () => {
    expect(usageRecordsQuerySchema.safeParse({ provider: 'other' }).success).toBe(false);
    expect(usageRecordsQuerySchema.safeParse({ status: 'waiting' }).success).toBe(false);
    expect(usageRecordsQuerySchema.safeParse({ tenantId: 'other' }).success).toBe(false);
    expect(usageRecordsQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });

  it('rejects a date range where from is after to', () => {
    expect(usageRecordsQuerySchema.safeParse({
      from: '2026-10-12T00:00:00.000Z',
      to: '2026-10-11T00:00:00.000Z',
    }).success).toBe(false);
  });
});
