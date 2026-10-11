import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  icp: { _id: '507f1f77bcf86cd799439012', isActive: true },
  campaign: { _id: '507f1f77bcf86cd799439013', icpId: '507f1f77bcf86cd799439012', name: 'Demo', channel: 'email', status: 'draft', createdBy: '507f1f77bcf86cd799439011', createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z') } as any,
  findIcp: vi.fn(), createCampaign: vi.fn(), findCampaign: vi.fn(), listCampaigns: vi.fn(),
  updateCampaignName: vi.fn(), transitionCampaign: vi.fn(), cancelCampaignAndUnsentMessages: vi.fn(),
  campaignMessageCounts: vi.fn(),
}));

vi.mock('../src/repositories/outreach.repository.js', () => ({ outreachRepository: {
  findIcp: mocks.findIcp, createCampaign: mocks.createCampaign, findCampaign: mocks.findCampaign,
  listCampaigns: mocks.listCampaigns, updateCampaignName: mocks.updateCampaignName,
  transitionCampaign: mocks.transitionCampaign, cancelCampaignAndUnsentMessages: mocks.cancelCampaignAndUnsentMessages,
  campaignMessageCounts: mocks.campaignMessageCounts,
} }));

import { campaignService } from '../src/services/campaign.service.js';

const startupId = '507f1f77bcf86cd799439011';
const icpId = '507f1f77bcf86cd799439012';
const campaignId = '507f1f77bcf86cd799439013';

beforeEach(() => {
  mocks.icp = { _id: icpId, isActive: true };
  mocks.campaign = { _id: campaignId, icpId, name: 'Demo', channel: 'email', status: 'draft', createdBy: startupId, createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z') };
  mocks.findIcp.mockReset().mockImplementation(async () => mocks.icp);
  mocks.createCampaign.mockReset().mockImplementation(async (input: any) => ({ _id: campaignId, ...input, status: 'draft', createdAt: new Date(), updatedAt: new Date() }));
  mocks.findCampaign.mockReset().mockImplementation(async () => mocks.campaign);
  mocks.listCampaigns.mockReset().mockResolvedValue({ items: [mocks.campaign], total: 1 });
  mocks.updateCampaignName.mockReset().mockImplementation(async (_startup: unknown, _id: unknown, name: string) => ({ ...mocks.campaign, name }));
  mocks.transitionCampaign.mockReset().mockImplementation(async (input: any) => {
    if (!input.from.includes(mocks.campaign.status)) return null;
    mocks.campaign = { ...mocks.campaign, status: input.to, ...(input.approvedBy ? { approvedBy: input.approvedBy, approvedAt: input.approvedAt } : {}) };
    return mocks.campaign;
  });
  mocks.cancelCampaignAndUnsentMessages.mockReset().mockImplementation(async () => {
    if (['completed', 'cancelled'].includes(mocks.campaign.status)) return null;
    mocks.campaign = { ...mocks.campaign, status: 'cancelled' };
    return mocks.campaign;
  });
  mocks.campaignMessageCounts.mockReset().mockResolvedValue({ draft: 2, ready: 1 });
});

describe('campaignService', () => {
  it('creates an email campaign only for an active ICP in the same workspace', async () => {
    const result = await campaignService.create({ startupId, userId: startupId, icpId, name: ' Demo ', channel: 'email' });
    expect(result).toMatchObject({ id: campaignId, name: 'Demo', channel: 'email', status: 'draft' });
    expect(mocks.createCampaign).toHaveBeenCalledWith(expect.objectContaining({ name: 'Demo' }));
  });

  it('rejects an ICP outside the workspace', async () => {
    mocks.findIcp.mockResolvedValue(null);
    await expect(campaignService.create({ startupId, userId: startupId, icpId, name: 'Demo', channel: 'email' }))
      .rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
    expect(mocks.createCampaign).not.toHaveBeenCalled();
  });

  it('rejects an archived ICP', async () => {
    mocks.icp = { _id: icpId, isActive: false };
    mocks.findIcp.mockImplementation(async () => mocks.icp);
    await expect(campaignService.create({ startupId, userId: startupId, icpId, name: 'Demo', channel: 'email' }))
      .rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
  });

  it('enforces state transitions rather than arbitrary status updates', async () => {
    mocks.campaign = { ...mocks.campaign, status: 'active' };
    await expect(campaignService.submit(startupId, campaignId)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(mocks.transitionCampaign).not.toHaveBeenCalled();
  });

  it('records campaign approval only from pending_approval', async () => {
    mocks.campaign = { ...mocks.campaign, status: 'pending_approval' };
    const result = await campaignService.approve(startupId, campaignId, startupId);
    expect(result.status).toBe('approved');
    expect(result.approvedBy).toBe(startupId);
    expect(mocks.transitionCampaign).toHaveBeenCalledWith(expect.objectContaining({ from: ['pending_approval'], to: 'approved' }));
  });

  it('cancels the campaign and asks the repository to cancel all unsent drafts atomically', async () => {
    const result = await campaignService.cancel(startupId, campaignId);
    expect(result.status).toBe('cancelled');
    expect(mocks.cancelCampaignAndUnsentMessages).toHaveBeenCalled();
  });

  it('returns tenant-scoped counts in the campaign detail response', async () => {
    const result = await campaignService.get(startupId, campaignId);
    expect(result.messageCounts).toEqual({ draft: 2, ready: 1 });
    expect(mocks.campaignMessageCounts).toHaveBeenCalled();
  });
});
