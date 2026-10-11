import mongoose, { Types } from 'mongoose';
import { Icp } from '../models/icp.model.js';
import { Prospect } from '../models/prospect.model.js';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { Startup } from '../models/startup.model.js';
import { SalesActivity } from '../models/sales-activity.model.js';
import { OutreachCampaign } from '../models/outreach-campaign.model.js';
import type { CampaignStatus } from '../types/outreach.js';
import { OutreachMessage } from '../models/outreach-message.model.js';

export type OutreachActivityType =
  | 'message_approved' | 'handoff_requested' | 'message_user_reported_sent';

export const outreachRepository = {
  findIcp(startupId: Types.ObjectId, icpId: Types.ObjectId) {
    return Icp.findOne({ _id: icpId, startupId }).lean();
  },

  createCampaign(input: {
    startupId: Types.ObjectId; icpId: Types.ObjectId; name: string; channel: 'email'; createdBy: Types.ObjectId;
  }) {
    return OutreachCampaign.create({ ...input, status: 'draft' });
  },

  findCampaign(startupId: Types.ObjectId, campaignId: Types.ObjectId) {
    return OutreachCampaign.findOne({ _id: campaignId, startupId }).lean();
  },

  async listCampaigns(startupId: Types.ObjectId, query: {
    status?: string; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId };
    if (query.status !== undefined) filter.status = query.status;
    const sort = query.sort === 'createdAt' ? { createdAt: 1 as const, _id: 1 as const } : { createdAt: -1 as const, _id: -1 as const };
    const [items, total] = await Promise.all([
      OutreachCampaign.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      OutreachCampaign.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateCampaignName(startupId: Types.ObjectId, campaignId: Types.ObjectId, name: string) {
    return OutreachCampaign.findOneAndUpdate(
      { _id: campaignId, startupId, status: 'draft' },
      { $set: { name } }, { new: true, runValidators: true },
    );
  },

  transitionCampaign(input: {
    startupId: Types.ObjectId; campaignId: Types.ObjectId; from: CampaignStatus[]; to: CampaignStatus;
    approvedBy?: Types.ObjectId; approvedAt?: Date;
  }) {
    const $set: Record<string, unknown> = { status: input.to };
    if (input.approvedBy) $set.approvedBy = input.approvedBy;
    if (input.approvedAt) $set.approvedAt = input.approvedAt;
    return OutreachCampaign.findOneAndUpdate(
      { _id: input.campaignId, startupId: input.startupId, status: { $in: input.from } },
      { $set }, { new: true, runValidators: true },
    );
  },

  async cancelCampaignAndUnsentMessages(startupId: Types.ObjectId, campaignId: Types.ObjectId) {
    const session = await mongoose.startSession();
    try {
      let campaign: any = null;
      await session.withTransaction(async () => {
        campaign = await OutreachCampaign.findOneAndUpdate(
          { _id: campaignId, startupId, status: { $in: ['draft', 'pending_approval', 'approved', 'active', 'paused'] } },
          { $set: { status: 'cancelled' } }, { new: true, session, runValidators: true },
        );
        if (!campaign) return;
        await OutreachMessage.updateMany(
          { startupId, campaignId, status: { $in: ['draft', 'ready'] } },
          { $set: { status: 'cancelled' } }, { session, runValidators: true },
        );
      });
      return campaign;
    } finally {
      await session.endSession();
    }
  },

  async campaignMessageCounts(startupId: Types.ObjectId, campaignId: Types.ObjectId) {
    const rows = await OutreachMessage.aggregate([
      { $match: { startupId, campaignId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]).exec() as Array<{ _id: string; count: number }>;
    return Object.fromEntries(rows.map(row => [row._id, row.count]));
  },

  findMessage(startupId: Types.ObjectId, messageId: Types.ObjectId) {
    return OutreachMessage.findOne({ _id: messageId, startupId }).lean();
  },

  findMessageByIdempotencyKey(startupId: Types.ObjectId, idempotencyKey: string) {
    return OutreachMessage.findOne({ startupId, idempotencyKey }).lean();
  },

  findContact(startupId: Types.ObjectId, decisionMakerId: Types.ObjectId) {
    return DecisionMaker.findOne({ _id: decisionMakerId, startupId }).lean();
  },

  findProspect(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return Prospect.findOne({ _id: prospectId, startupId }).lean();
  },

  findStartupSettings(startupId: Types.ObjectId) {
    return Startup.findOne({ _id: startupId, status: { $in: ['active', 'trial_expired'] } })
      .select('_id settings')
      .lean();
  },

  createMessage(input: {
    startupId: Types.ObjectId; campaignId: Types.ObjectId; prospectId: Types.ObjectId;
    decisionMakerId: Types.ObjectId; step: number; revision: number; subject: string; body: string;
    approvalStatus: 'pending'; status: 'draft'; idempotencyKey: string; createdBy: Types.ObjectId;
  }) {
    return OutreachMessage.create(input);
  },

  regenerateMessage(input: {
    startupId: Types.ObjectId; messageId: Types.ObjectId; subject: string; body: string;
  }) {
    return OutreachMessage.findOneAndUpdate(
      { _id: input.messageId, startupId: input.startupId, status: 'draft', approvalStatus: { $ne: 'approved' } },
      {
        $set: { subject: input.subject, body: input.body, approvalStatus: 'pending', status: 'draft' },
        $inc: { revision: 1 },
        $unset: { approvedBy: 1, approvedAt: 1 },
      }, { new: true, runValidators: true },
    );
  },

  async listMessages(startupId: Types.ObjectId, query: {
    campaignId?: Types.ObjectId; prospectId?: Types.ObjectId; decisionMakerId?: Types.ObjectId;
    approvalStatus?: string; status?: string; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId };
    if (query.campaignId) filter.campaignId = query.campaignId;
    if (query.prospectId) filter.prospectId = query.prospectId;
    if (query.decisionMakerId) filter.decisionMakerId = query.decisionMakerId;
    if (query.approvalStatus) filter.approvalStatus = query.approvalStatus;
    if (query.status) filter.status = query.status;
    const sort = query.sort === 'createdAt' ? { createdAt: 1 as const, _id: 1 as const } : { createdAt: -1 as const, _id: -1 as const };
    const [items, total] = await Promise.all([
      OutreachMessage.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      OutreachMessage.countDocuments(filter),
    ]);
    return { items, total };
  },

  updateMessageContent(input: {
    startupId: Types.ObjectId; messageId: Types.ObjectId; subject?: string; body?: string;
  }) {
    const $set: Record<string, unknown> = { approvalStatus: 'pending', status: 'draft' };
    if (input.subject !== undefined) $set.subject = input.subject;
    if (input.body !== undefined) $set.body = input.body;
    return OutreachMessage.findOneAndUpdate(
      { _id: input.messageId, startupId: input.startupId, status: { $in: ['draft', 'ready'] } },
      { $set, $unset: { approvedBy: 1, approvedAt: 1 } },
      { new: true, runValidators: true },
    );
  },

  approveMessage(input: {
    startupId: Types.ObjectId; messageId: Types.ObjectId; approvedBy: Types.ObjectId; approvedAt: Date;
  }) {
    return OutreachMessage.findOneAndUpdate(
      { _id: input.messageId, startupId: input.startupId, status: 'draft', approvalStatus: { $ne: 'approved' } },
      { $set: { approvalStatus: 'approved', status: 'ready', approvedBy: input.approvedBy, approvedAt: input.approvedAt } },
      { new: true, runValidators: true },
    );
  },

  reviewMessage(input: {
    startupId: Types.ObjectId; messageId: Types.ObjectId; approvalStatus: 'rejected' | 'revision_requested';
  }) {
    return OutreachMessage.findOneAndUpdate(
      { _id: input.messageId, startupId: input.startupId, status: 'draft', approvalStatus: { $ne: 'approved' } },
      { $set: { approvalStatus: input.approvalStatus, status: 'draft' }, $unset: { approvedBy: 1, approvedAt: 1 } },
      { new: true, runValidators: true },
    );
  },

  resetHandoff(startupId: Types.ObjectId, messageId: Types.ObjectId) {
    return OutreachMessage.updateOne(
      { _id: messageId, startupId, status: 'handed_off', approvalStatus: 'approved' },
      { $set: { status: 'ready' } }, { runValidators: true },
    );
  },

  handoffMessage(startupId: Types.ObjectId, messageId: Types.ObjectId) {
    return OutreachMessage.findOneAndUpdate(
      { _id: messageId, startupId, status: 'ready', approvalStatus: 'approved' },
      { $set: { status: 'handed_off' } }, { new: true, runValidators: true },
    );
  },

  markMessageSent(input: { startupId: Types.ObjectId; messageId: Types.ObjectId; sentAt: Date }) {
    return OutreachMessage.findOneAndUpdate(
      { _id: input.messageId, startupId: input.startupId, status: 'handed_off' },
      { $set: { status: 'user_reported_sent', sentAt: input.sentAt } }, { new: true, runValidators: true },
    );
  },

  cancelMessage(startupId: Types.ObjectId, messageId: Types.ObjectId) {
    return OutreachMessage.findOneAndUpdate(
      { _id: messageId, startupId, status: { $in: ['draft', 'ready'] } },
      { $set: { status: 'cancelled' } }, { new: true, runValidators: true },
    );
  },

  async recordActivity(input: {
    startupId: Types.ObjectId; prospectId: Types.ObjectId; campaignId: Types.ObjectId; messageId: Types.ObjectId;
    activityType: OutreachActivityType; summary: string; source: 'manual'; occurredAt: Date;
  }) {
    const { source, ...record } = input;
    return SalesActivity.create({
      ...record,
      metadata: { messageId: String(input.messageId), source },
    });
  },
};
