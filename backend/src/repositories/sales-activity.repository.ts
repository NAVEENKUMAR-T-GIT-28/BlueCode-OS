import type { Types } from 'mongoose';
import { SalesActivity } from '../models/sales-activity.model.js';
import type { ProspectStatus } from '../types/prospect.js';

export const salesActivityRepository = {
  recordStatusChange(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId;
    fromStatus: ProspectStatus; toStatus: ProspectStatus; reason?: string;
  }) {
    const metadata: Record<string, string> = {
      fromStatus: input.fromStatus, toStatus: input.toStatus, source: 'manual',
    };
    if (input.reason !== undefined) metadata.reason = input.reason;
    return SalesActivity.create({
      startupId: input.startupId, prospectId: input.prospectId,
      activityType: 'status_changed',
      summary: `Prospect status changed from ${input.fromStatus} to ${input.toStatus}.`,
      metadata, occurredAt: new Date(),
    });
  },

  listRecent(startupId: Types.ObjectId, prospectId: Types.ObjectId, limit = 20) {
    return SalesActivity.find({ startupId, prospectId }).sort({ occurredAt: -1, _id: -1 }).limit(limit).lean();
  },
};
