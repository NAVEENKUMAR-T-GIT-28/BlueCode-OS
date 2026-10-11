import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { ApiError } from '../shared/api-error.js';
import { getEntitlementLimit } from '../config/entitlement-limits.js';
import { usageRepository, type UsageRecordInput } from '../repositories/usage.repository.js';
import { clock } from '../utils/clock.js';
import {
  assertNonNegativeIntegerPaise, assertPositiveIntegerPaise,
  isProviderOutcomeUnknown, remainingPaise, sanitizeErrorCode,
} from '../utils/usage-domain.js';
import { getDefaultCostType } from '../config/usage-estimates.js';
import type {
  EntitlementMetric, UsageCallResult, UsageContext, UsageCostType,
  UsageProvider, UsageRecordQuery, UsageStatus,
} from '../types/usage.js';

interface Reservation {
  id: string;
  startupId: Types.ObjectId;
  provider: UsageProvider;
  operation: string;
  estimatePaise: number;
  requestId?: string;
  entityRef?: { kind: string; id: string };
  createdAt: Date;
  state: 'open' | 'finalizing';
}

class ReservationRegistry {
  private readonly entries = new Map<string, Reservation>();

  add(reservation: Reservation) {
    this.entries.set(reservation.id, reservation);
  }

  claim(id: string): Reservation | undefined {
    const reservation = this.entries.get(id);
    if (!reservation || reservation.state !== 'open') return undefined;
    reservation.state = 'finalizing';
    return reservation;
  }

  complete(id: string) {
    this.entries.delete(id);
  }

  reopen(id: string) {
    const reservation = this.entries.get(id);
    if (reservation) reservation.state = 'open';
  }
}

const registry = new ReservationRegistry();

function providerFor(operation: string): UsageProvider {
  if (operation.startsWith('apollo.')) return 'apollo';
  if (operation.startsWith('llm.')) return 'llm';
  throw new ApiError(400, 'VALIDATION_FAILED', 'Usage operation must begin with apollo. or llm.');
}

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

function commonRecord(reservation: Reservation, input: {
  status: UsageStatus;
  costAmount: number;
  costType: UsageCostType;
  errorCode?: string;
  creditsConsumed?: number;
}): UsageRecordInput {
  return {
    startupId: reservation.startupId,
    provider: reservation.provider,
    operation: reservation.operation,
    status: input.status,
    costAmount: input.costAmount,
    costType: input.costType,
    occurredAt: clock.now(),
    ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
    ...(input.creditsConsumed !== undefined ? { creditsConsumed: input.creditsConsumed } : {}),
    ...(reservation.requestId !== undefined ? { requestId: reservation.requestId } : {}),
    ...(reservation.entityRef !== undefined ? { entityRef: reservation.entityRef } : {}),
  };
}

export const usageService = {
  async reserve(context: UsageContext, operation: string, estimatePaise: number): Promise<string> {
    assertPositiveIntegerPaise(estimatePaise);
    const startupId = objectId(context.startupId, 'startup ID');
    const provider = providerFor(operation);
    const updated = await usageRepository.reserveBudget(startupId, estimatePaise);
    if (!updated) {
      const startup = await usageRepository.findStartup(startupId);
      if (!startup) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
      if (startup.status === 'trial_expired') {
        throw new ApiError(402, 'TRIAL_EXPIRED', 'The trial has ended; this workspace is read-only');
      }
      if (startup.status === 'suspended') {
        throw new ApiError(403, 'FORBIDDEN', 'Workspace access is suspended');
      }

      const used = startup.spendCommitted + startup.spendReserved;
      await usageRepository.appendRecord({
        startupId, provider, operation, status: 'blocked',
        costAmount: 0, costType: 'estimated', occurredAt: clock.now(),
        ...(context.requestId !== undefined ? { requestId: context.requestId } : {}),
        ...(context.entityRef !== undefined ? { entityRef: context.entityRef } : {}),
        errorCode: 'BUDGET_EXHAUSTED',
      });
      throw new ApiError(402, 'BUDGET_EXHAUSTED', 'The workspace spend cap would be exceeded', {
        metric: 'spend', used, limit: startup.apiSpendCap,
      });
    }

    const id = randomUUID();
    registry.add({
      id, startupId, provider, operation, estimatePaise,
      createdAt: clock.now(), state: 'open',
      ...(context.requestId !== undefined ? { requestId: context.requestId } : {}),
      ...(context.entityRef !== undefined ? { entityRef: context.entityRef } : {}),
    });
    return id;
  },

  async commit(id: string, input: {
    actualCostPaise: number;
    costType: UsageCostType;
    status?: 'success' | 'failed';
    errorCode?: string;
    creditsConsumed?: number;
  }): Promise<boolean> {
    assertNonNegativeIntegerPaise(input.actualCostPaise);
    if (input.creditsConsumed !== undefined &&
        (typeof input.creditsConsumed !== 'number' || !Number.isFinite(input.creditsConsumed) || input.creditsConsumed < 0)) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'creditsConsumed must be a non-negative finite number');
    }
    const reservation = registry.claim(id);
    if (!reservation) return false;

    try {
      await usageRepository.finalizeReservation({
        startupId: reservation.startupId,
        estimatePaise: reservation.estimatePaise,
        committedCostPaise: input.actualCostPaise,
        record: commonRecord(reservation, {
          status: input.status ?? 'success',
          costAmount: input.actualCostPaise,
          costType: input.costType,
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.creditsConsumed !== undefined ? { creditsConsumed: input.creditsConsumed } : {}),
        }),
      });
      registry.complete(id);
      if (input.actualCostPaise > reservation.estimatePaise) {
        console.warn(JSON.stringify({
          level: 'warn', event: 'usage_estimate_overrun',
          operation: reservation.operation, estimatePaise: reservation.estimatePaise,
          actualCostPaise: input.actualCostPaise,
        }));
      }
      return true;
    } catch (error) {
      registry.reopen(id);
      throw error;
    }
  },

  async release(id: string, errorCode = 'PROVIDER_FAILED'): Promise<boolean> {
    const reservation = registry.claim(id);
    if (!reservation) return false;
    try {
      await usageRepository.finalizeReservation({
        startupId: reservation.startupId,
        estimatePaise: reservation.estimatePaise,
        committedCostPaise: 0,
        record: commonRecord(reservation, {
          status: 'failed', costAmount: 0, costType: 'estimated',
          errorCode: /^[A-Z0-9_:-]{1,100}$/.test(errorCode) ? errorCode : 'PROVIDER_FAILED',
        }),
      });
      registry.complete(id);
      return true;
    } catch (error) {
      registry.reopen(id);
      throw error;
    }
  },

  async withUsage<T>(
    context: UsageContext,
    operation: string,
    estimatePaise: number,
    call: () => Promise<UsageCallResult<T>>,
  ): Promise<T> {
    const reservationId = await this.reserve(context, operation, estimatePaise);
    let result: UsageCallResult<T>;
    try {
      result = await call();
    } catch (error) {
      if (isProviderOutcomeUnknown(error)) {
        await this.commit(reservationId, {
          actualCostPaise: estimatePaise, costType: 'estimated',
          status: 'failed', errorCode: 'PROVIDER_TIMEOUT',
        });
        throw new ApiError(502, 'PROVIDER_FAILED', 'The provider outcome is unknown; estimated spend was recorded');
      }
      await this.release(reservationId, sanitizeErrorCode(error));
      throw error;
    }

    await this.commit(reservationId, {
      actualCostPaise: result.actualCostPaise ?? estimatePaise,
      costType: result.costType ?? getDefaultCostType(result.actualCostPaise !== undefined),
      status: 'success',
      ...(result.creditsConsumed !== undefined ? { creditsConsumed: result.creditsConsumed } : {}),
    });
    return result.value;
  },

  async getSummary(startupIdValue: string) {
    const startupId = objectId(startupIdValue, 'startup ID');
    const startup = await usageRepository.findStartup(startupId);
    if (!startup) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    const [counts, costTypes] = await Promise.all([
      usageRepository.entitlementCounts(startupId),
      usageRepository.costTypeTotals(startupId),
    ]);
    const estimatedTotal = costTypes.filter(row => row._id === 'estimated').reduce((sum, row) => sum + row.total, 0);
    const reportedTotal = costTypes.filter(row => row._id === 'reported').reduce((sum, row) => sum + row.total, 0);
    const costType: UsageCostType = estimatedTotal > 0 || reportedTotal === 0 ? 'estimated' : 'reported';
    const trialDaysLeft = startup.plan === 'trial' && startup.trialEndsAt
      ? Math.max(0, Math.ceil((startup.trialEndsAt.getTime() - clock.now().getTime()) / 86_400_000))
      : null;

    // No usage entitlement limits are assigned values until the owner freezes them.
    return {
      plan: startup.plan,
      trialEndsAt: startup.trialEndsAt ?? null,
      trialDaysLeft,
      spend: {
        capPaise: startup.apiSpendCap,
        committedPaise: startup.spendCommitted,
        reservedPaise: startup.spendReserved,
        remainingPaise: remainingPaise(startup.apiSpendCap, startup.spendCommitted, startup.spendReserved),
        costType,
      },
      entitlements: {
        prospects: { used: counts.prospects, limit: null },
        dmSearches: { used: counts.dmSearches, limit: null },
        emails: { used: counts.emails, limit: null },
        icps: { used: counts.icps, limit: null },
      },
    };
  },

  async listRecords(startupIdValue: string, query: UsageRecordQuery) {
    const startupId = objectId(startupIdValue, 'startup ID');
    const result = await usageRepository.listRecords(startupId, query);
    return {
      items: result.items.map((record: any) => ({
        id: String(record._id),
        provider: record.provider,
        operation: record.operation,
        status: record.status,
        ...(record.creditsConsumed !== undefined ? { creditsConsumed: record.creditsConsumed } : {}),
        ...(record.costAmount !== undefined ? { costPaise: record.costAmount } : {}),
        costType: record.costType,
        ...(record.errorCode ? { errorCode: record.errorCode } : {}),
        occurredAt: record.occurredAt,
      })),
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  },

  async checkEntitlement(startupIdValue: string, plan: 'trial' | 'starter' | 'growth' | 'pro', metric: EntitlementMetric) {
    const startupId = objectId(startupIdValue, 'startup ID');
    const used = await usageRepository.countEntitlementUsage(startupId, metric);
    const limit = getEntitlementLimit(plan, metric);
    if (limit !== undefined && used >= limit) {
      throw new ApiError(402, 'PLAN_LIMIT_REACHED', 'Workspace entitlement reached', { metric, used, limit });
    }
    return { allowed: true as const, used, limit: limit ?? null };
  },

  async recoverDanglingReservations() {
    const affected = await usageRepository.recoverReservedCounters();
    console.info(JSON.stringify({
      level: 'info', event: 'usage_reservation_recovery', affectedStartups: affected,
    }));
    return affected;
  },
};
