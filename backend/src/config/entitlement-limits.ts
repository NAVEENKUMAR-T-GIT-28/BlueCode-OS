import type { StartupPlan } from '../types/startup.js';
import type { EntitlementMetric } from '../types/usage.js';

/**
 * No prospect/search/draft/ICP usage-limit values are approved in the frozen docs.
 * Keep this registry empty instead of treating examples in API docs as product limits.
 */
const limits: Partial<Record<StartupPlan, Partial<Record<EntitlementMetric, number>>>> = {};

export function getEntitlementLimit(plan: StartupPlan, metric: EntitlementMetric): number | undefined {
  return limits[plan]?.[metric];
}
