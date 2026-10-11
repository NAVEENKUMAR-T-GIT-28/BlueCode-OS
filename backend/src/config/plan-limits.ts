import type { StartupPlan } from '../types/startup.js';

// Only the pilot entitlement explicitly established in the frozen architecture is encoded here.
// Other plans deliberately remain undefined until their maxUsers limits are specified.
const maxUsersByPlan: Partial<Record<StartupPlan, number>> = {
  trial: 1,
};

export function getMaxUsersForPlan(plan: StartupPlan): number | undefined {
  return maxUsersByPlan[plan];
}
