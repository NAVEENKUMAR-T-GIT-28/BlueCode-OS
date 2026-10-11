import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cap: 100,
  committed: 0,
  reserved: 0,
  records: [] as Array<Record<string, unknown>>,
  reserveBudget: vi.fn(),
  findStartup: vi.fn(),
  appendRecord: vi.fn(),
  finalizeReservation: vi.fn(),
  recoverReservedCounters: vi.fn(),
  listRecords: vi.fn(),
  costTypeTotals: vi.fn(),
  entitlementCounts: vi.fn(),
  countEntitlementUsage: vi.fn(),
}));

vi.mock('../src/repositories/usage.repository.js', () => ({
  usageRepository: {
    reserveBudget: mocks.reserveBudget,
    findStartup: mocks.findStartup,
    appendRecord: mocks.appendRecord,
    finalizeReservation: mocks.finalizeReservation,
    recoverReservedCounters: mocks.recoverReservedCounters,
    listRecords: mocks.listRecords,
    costTypeTotals: mocks.costTypeTotals,
    entitlementCounts: mocks.entitlementCounts,
    countEntitlementUsage: mocks.countEntitlementUsage,
  },
}));

import { usageService } from '../src/services/usage.service.js';

const startupId = '507f1f77bcf86cd799439011';

beforeEach(() => {
  mocks.cap = 100;
  mocks.committed = 0;
  mocks.reserved = 0;
  mocks.records.length = 0;

  mocks.reserveBudget.mockReset().mockImplementation(async (_startupId: unknown, estimate: number) => {
    if (mocks.committed + mocks.reserved + estimate > mocks.cap) return null;
    mocks.reserved += estimate;
    return { _id: startupId, status: 'active' };
  });
  mocks.findStartup.mockReset().mockImplementation(async () => ({
    _id: startupId,
    status: 'active',
    apiSpendCap: mocks.cap,
    spendCommitted: mocks.committed,
    spendReserved: mocks.reserved,
    plan: 'trial',
    trialEndsAt: undefined,
  }));
  mocks.appendRecord.mockReset().mockImplementation(async (row: Record<string, unknown>) => {
    mocks.records.push(row);
    return row;
  });
  mocks.finalizeReservation.mockReset().mockImplementation(async (input: {
    estimatePaise: number;
    committedCostPaise: number;
    record: Record<string, unknown>;
  }) => {
    mocks.reserved -= input.estimatePaise;
    mocks.committed += input.committedCostPaise;
    mocks.records.push(input.record);
  });
  mocks.recoverReservedCounters.mockReset().mockResolvedValue(2);
  mocks.listRecords.mockReset().mockResolvedValue({ items: [], total: 0 });
  mocks.costTypeTotals.mockReset().mockResolvedValue([]);
  mocks.entitlementCounts.mockReset().mockResolvedValue({ prospects: 0, dmSearches: 0, emails: 0, icps: 0 });
  mocks.countEntitlementUsage.mockReset().mockResolvedValue(0);
});

describe('Usage reservation lifecycle', () => {
  it('reserves atomically and blocks requests that would exceed the cap', async () => {
    const outcomes = await Promise.allSettled(
      Array.from({ length: 50 }, () => usageService.reserve({ startupId }, 'apollo.org_search', 10)),
    );
    const succeeded = outcomes.filter(result => result.status === 'fulfilled') as PromiseFulfilledResult<string>[];
    const rejected = outcomes.filter(result => result.status === 'rejected');

    expect(succeeded).toHaveLength(10);
    expect(rejected).toHaveLength(40);
    expect(mocks.reserved + mocks.committed).toBeLessThanOrEqual(mocks.cap);
    expect(mocks.records.filter(row => row.status === 'blocked')).toHaveLength(40);

    await Promise.all(succeeded.map(result => usageService.commit(result.value, {
      actualCostPaise: 10,
      costType: 'estimated',
    })));
    expect(mocks.committed).toBe(100);
    expect(mocks.reserved).toBe(0);
  });

  it('commits a reservation only once when commit is called twice', async () => {
    const reservation = await usageService.reserve({ startupId, requestId: 'req-test' }, 'llm.signal_interpret', 25);

    expect(await usageService.commit(reservation, { actualCostPaise: 20, costType: 'reported' })).toBe(true);
    expect(await usageService.commit(reservation, { actualCostPaise: 20, costType: 'reported' })).toBe(false);
    expect(mocks.finalizeReservation).toHaveBeenCalledTimes(1);
    expect(mocks.reserved).toBe(0);
    expect(mocks.committed).toBe(20);
  });

  it('commits the estimate on an unknown provider outcome without retrying the call', async () => {
    const call = vi.fn().mockRejectedValue({ code: 'ETIMEDOUT' });
    await expect(usageService.withUsage(
      { startupId, requestId: 'req-timeout' },
      'apollo.org_search',
      30,
      call,
    )).rejects.toMatchObject({ status: 502, code: 'PROVIDER_FAILED' });

    expect(call).toHaveBeenCalledTimes(1);
    expect(mocks.committed).toBe(30);
    expect(mocks.reserved).toBe(0);
    expect(mocks.records.at(-1)).toMatchObject({
      status: 'failed',
      costAmount: 30,
      costType: 'estimated',
      errorCode: 'PROVIDER_TIMEOUT',
    });
  });

  it('releases the reservation for a definite failure with zero committed cost', async () => {
    const call = vi.fn().mockRejectedValue({ code: 'BAD_REQUEST' });
    await expect(usageService.withUsage(
      { startupId },
      'llm.signal_interpret',
      20,
      call,
    )).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(mocks.committed).toBe(0);
    expect(mocks.reserved).toBe(0);
    expect(mocks.records.at(-1)).toMatchObject({ status: 'failed', costAmount: 0 });
  });
});
