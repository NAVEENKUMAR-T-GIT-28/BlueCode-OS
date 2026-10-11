import { ApiError } from '../shared/api-error.js';
import type { UsageCostType } from '../types/usage.js';

/**
 * Numeric estimates are intentionally empty until the owner approves the per-operation
 * cost policy. Do not fill this with guessed amounts. Paid routes must resolve an estimate
 * here before making a provider request.
 */
export const usageEstimates: Readonly<Record<string, number>> = Object.freeze({});

export function getUsageEstimate(operation: string): number {
  const estimate = usageEstimates[operation];
  if (estimate === undefined) {
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'No approved cost estimate is configured for this operation', {
      operation,
      capability: 'usage_estimate',
    });
  }
  if (!Number.isSafeInteger(estimate) || estimate <= 0) {
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'The configured cost estimate is invalid', {
      operation,
      capability: 'usage_estimate',
    });
  }
  return estimate;
}

export function getDefaultCostType(hasProviderReportedCost: boolean): UsageCostType {
  return hasProviderReportedCost ? 'reported' : 'estimated';
}
