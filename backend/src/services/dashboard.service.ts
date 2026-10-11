import { Types } from 'mongoose';
import { dashboardRepository } from '../repositories/dashboard.repository.js';
import { nextBestActionService } from './next-action.service.js';
import { usageService } from './usage.service.js';
import { clock } from '../utils/clock.js';
import { ApiError } from '../shared/api-error.js';

export const dashboardService = {
  async get(startupIdValue: string) {
    if (!Types.ObjectId.isValid(startupIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed workspace ID');
    const now = clock.now();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const nextDay = new Date(dayStart.getTime() + 86_400_000);
    // The lazy rule refresh runs on page open; it does not schedule or send anything.
    const actionResult = await nextBestActionService.list(startupIdValue, { status: 'pending', sort: 'priority' });
    const [metrics, usage] = await Promise.all([
      dashboardRepository.snapshot({ startupId: new Types.ObjectId(startupIdValue), now, dayStart, nextDay }),
      usageService.getSummary(startupIdValue),
    ]);
    return {
      ...metrics,
      topActions: actionResult.items.slice(0, 5),
      usage: { remainingPaise: usage.spend.remainingPaise, trialDaysLeft: usage.trialDaysLeft },
    };
  },
};
