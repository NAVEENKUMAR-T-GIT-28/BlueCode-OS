import { Types } from 'mongoose';
import { NextBestAction } from '../models/next-best-action.model.js';

export const nextBestActionRepository = {
  findById(startupId: Types.ObjectId, actionId: Types.ObjectId) {
    return NextBestAction.findOne({ _id: actionId, startupId }).lean();
  },

  findActionBasedOnActivity(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId; actionType: string; activityId: Types.ObjectId;
  }) {
    return NextBestAction.findOne({
      startupId: input.startupId, prospectId: input.prospectId, actionType: input.actionType,
      basedOnActivityIds: input.activityId,
    }).lean();
  },

  async upsertPending(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId; decisionMakerId?: Types.ObjectId;
    actionType: 'follow_up' | 'send_reply' | 'share_information' | 'book_meeting' | 'nurture' | 'stop_outreach' | 'review_prospect';
    title: string; reason: string; priority: 'low' | 'medium' | 'high'; dueAt?: Date; expiresAt?: Date; basedOnActivityIds: Types.ObjectId[];
  }) {
    const existing = await NextBestAction.findOne({
      startupId: input.startupId, prospectId: input.prospectId, actionType: input.actionType, status: 'pending',
    }).lean();
    if (existing) return { item: existing, created: false };
    try {
      const item = await NextBestAction.create({ ...input, status: 'pending' });
      return { item, created: true };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000) {
        const concurrent = await NextBestAction.findOne({
          startupId: input.startupId, prospectId: input.prospectId, actionType: input.actionType, status: 'pending',
        }).lean();
        if (concurrent) return { item: concurrent, created: false };
      }
      throw error;
    }
  },

  async listActions(input: {
    startupId: Types.ObjectId; status: 'pending' | 'accepted' | 'dismissed' | 'completed' | 'expired';
    prospectId?: Types.ObjectId; now: Date; limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId: input.startupId };
    if (input.prospectId) filter.prospectId = input.prospectId;
    if (input.status === 'expired') {
      filter.status = { $in: ['pending', 'accepted'] };
      filter.expiresAt = { $lte: input.now };
    } else {
      filter.status = input.status;
      filter.$or = [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: input.now } }];
    }
    return NextBestAction.find(filter).sort({ createdAt: -1, _id: -1 }).limit(input.limit).lean();
  },

  transition(input: {
    startupId: Types.ObjectId; actionId: Types.ObjectId; from: Array<'pending' | 'accepted' | 'dismissed' | 'completed'>;
    to: 'accepted' | 'dismissed' | 'completed';
  }) {
    return NextBestAction.findOneAndUpdate(
      { _id: input.actionId, startupId: input.startupId, status: { $in: input.from } },
      { $set: { status: input.to } }, { new: true, runValidators: true },
    ).lean();
  },
};
