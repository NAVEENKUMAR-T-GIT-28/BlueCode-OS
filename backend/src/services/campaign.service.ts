import { Types } from 'mongoose';
import { ApiError } from '../shared/api-error.js';
import { outreachRepository } from '../repositories/outreach.repository.js';
import type { CampaignStatus } from '../types/outreach.js';

function id(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

function campaignDto(doc: any) {
  return {
    id: id(doc._id), icpId: id(doc.icpId), name: doc.name, channel: doc.channel,
    status: doc.status, ...(doc.approvedBy ? { approvedBy: id(doc.approvedBy) } : {}),
    ...(doc.approvedAt ? { approvedAt: doc.approvedAt } : {}),
    createdBy: id(doc.createdBy), createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };
}

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

const terminal = new Set<CampaignStatus>(['completed', 'cancelled']);

export const campaignService = {
  async create(input: { startupId: string; userId: string; icpId: string; name: string; channel: 'email' }) {
    const startupId = objectId(input.startupId, 'workspace ID');
    const icpId = objectId(input.icpId, 'ICP ID');
    const icp = await outreachRepository.findIcp(startupId, icpId);
    if (!icp) throw new ApiError(422, 'VALIDATION_FAILED', 'The ICP must belong to this workspace', { path: 'icpId' });
    if (!icp.isActive) throw new ApiError(409, 'INVALID_STATE', 'Archived ICPs cannot be used for a campaign');
    const campaign = await outreachRepository.createCampaign({
      startupId, icpId, name: input.name.trim(), channel: input.channel,
      createdBy: objectId(input.userId, 'user ID'),
    });
    return campaignDto(campaign);
  },

  async list(startupIdValue: string, query: {
    status?: CampaignStatus; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const result = await outreachRepository.listCampaigns(objectId(startupIdValue, 'workspace ID'), query);
    return { items: result.items.map(campaignDto), meta: { page: query.page, limit: query.limit, total: result.total } };
  },

  async get(startupIdValue: string, campaignIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const campaignId = objectId(campaignIdValue, 'campaign ID');
    const campaign = await outreachRepository.findCampaign(startupId, campaignId);
    if (!campaign) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    const messageCounts = await outreachRepository.campaignMessageCounts(startupId, campaignId);
    return { ...campaignDto(campaign), messageCounts };
  },

  async updateName(startupIdValue: string, campaignIdValue: string, name: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const campaignId = objectId(campaignIdValue, 'campaign ID');
    const current = await outreachRepository.findCampaign(startupId, campaignId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    if (current.status !== 'draft') throw new ApiError(409, 'INVALID_STATE', 'Only draft campaigns can be renamed');
    const updated = await outreachRepository.updateCampaignName(startupId, campaignId, name.trim());
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Campaign status changed; refresh and retry');
    return campaignDto(updated);
  },

  async submit(startupId: string, campaignId: string) {
    return this.transition(startupId, campaignId, ['draft'], 'pending_approval');
  },

  async approve(startupIdValue: string, campaignIdValue: string, userIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const campaignId = objectId(campaignIdValue, 'campaign ID');
    const current = await outreachRepository.findCampaign(startupId, campaignId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    if (current.status !== 'pending_approval') throw new ApiError(409, 'INVALID_STATE', 'Only campaigns pending approval can be approved');
    const updated = await outreachRepository.transitionCampaign({
      startupId, campaignId, from: ['pending_approval'], to: 'approved',
      approvedBy: objectId(userIdValue, 'user ID'), approvedAt: new Date(),
    });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Campaign status changed; refresh and retry');
    return campaignDto(updated);
  },

  async pause(startupId: string, campaignId: string) {
    return this.transition(startupId, campaignId, ['active'], 'paused');
  },
  async resume(startupId: string, campaignId: string) {
    return this.transition(startupId, campaignId, ['paused'], 'active');
  },
  async complete(startupId: string, campaignId: string) {
    return this.transition(startupId, campaignId, ['active', 'paused'], 'completed');
  },

  async cancel(startupIdValue: string, campaignIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const campaignId = objectId(campaignIdValue, 'campaign ID');
    const current = await outreachRepository.findCampaign(startupId, campaignId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    if (terminal.has(current.status as CampaignStatus)) throw new ApiError(409, 'INVALID_STATE', 'A completed or cancelled campaign cannot be cancelled again');
    const updated = await outreachRepository.cancelCampaignAndUnsentMessages(startupId, campaignId);
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Campaign status changed; refresh and retry');
    return campaignDto(updated);
  },

  async transition(startupIdValue: string, campaignIdValue: string, from: CampaignStatus[], to: CampaignStatus) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const campaignId = objectId(campaignIdValue, 'campaign ID');
    const current = await outreachRepository.findCampaign(startupId, campaignId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Campaign not found');
    if (!from.includes(current.status as CampaignStatus)) throw new ApiError(409, 'INVALID_STATE', `Campaign cannot transition from ${current.status} to ${to}`);
    const updated = await outreachRepository.transitionCampaign({ startupId, campaignId, from, to });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Campaign status changed; refresh and retry');
    return campaignDto(updated);
  },
};
