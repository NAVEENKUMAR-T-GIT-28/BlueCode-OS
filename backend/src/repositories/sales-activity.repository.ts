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
  recordReplyLogged(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId; campaignId?: Types.ObjectId;
    messageId?: Types.ObjectId; summary: string; occurredAt: Date;
  }) {
    return SalesActivity.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      activityType: 'reply_logged',
      summary: input.summary.slice(0, 500),
      metadata: { ...(input.messageId ? { messageId: String(input.messageId) } : {}), source: 'manual' },
      occurredAt: input.occurredAt,
    });
  },

  recordReplyClassified(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId; campaignId?: Types.ObjectId;
    messageId?: Types.ObjectId;
    intent: 'interested' | 'buying_interest' | 'not_now' | 'wrong_person' | 'referral' | 'objection' | 'unsubscribe' | 'out_of_office' | 'other';
    confidence: number; summary: string; occurredAt: Date;
  }) {
    return SalesActivity.create({
      startupId: input.startupId,
      prospectId: input.prospectId,
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.messageId ? { messageId: input.messageId } : {}),
      activityType: 'reply_classified',
      summary: input.summary.slice(0, 500),
      classification: { intent: input.intent, confidence: input.confidence },
      metadata: {
        ...(input.messageId ? { messageId: String(input.messageId) } : {}),
        intent: input.intent,
        confidence: input.confidence,
      },
      occurredAt: input.occurredAt,
    });
  },

  listActivities(input: {
    startupId: Types.ObjectId; prospectId?: Types.ObjectId; messageId?: Types.ObjectId;
    type?: string[]; from?: Date; to?: Date; sort: '-occurredAt' | 'occurredAt'; limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId: input.startupId };
    if (input.prospectId) filter.prospectId = input.prospectId;
    if (input.messageId) filter.messageId = input.messageId;
    if (input.type) filter.activityType = { $in: input.type };
    if (input.from || input.to) {
      const occurredAt: Record<string, Date> = {};
      if (input.from) occurredAt.$gte = input.from;
      if (input.to) occurredAt.$lte = input.to;
      filter.occurredAt = occurredAt;
    }
    const sort = input.sort === 'occurredAt'
      ? { occurredAt: 1 as const, _id: 1 as const }
      : { occurredAt: -1 as const, _id: -1 as const };
    return SalesActivity.find(filter).sort(sort).limit(Math.min(Math.max(input.limit, 1), 100)).lean();
  },

  async hasReplyAfter(startupId: Types.ObjectId, prospectId: Types.ObjectId, after: Date) {
    return Boolean(await SalesActivity.exists({
      startupId, prospectId, activityType: 'reply_logged', occurredAt: { $gt: after },
    }));
  },

  findLatestOutboundActivity(startupId: Types.ObjectId, messageId: Types.ObjectId) {
    return SalesActivity.findOne({
      startupId, messageId, activityType: { $in: ['handoff_requested', 'message_user_reported_sent'] },
    }).sort({ occurredAt: -1, _id: -1 }).lean();
  },
};
