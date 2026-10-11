import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';

const mocks = vi.hoisted(() => ({
  llmMode: 'mock' as 'mock' | 'live',
  campaign: null as any,
  contact: null as any,
  prospect: null as any,
  settings: null as any,
  existing: null as any,
  message: null as any,
  findCampaign: vi.fn(), findContact: vi.fn(), findProspect: vi.fn(), findStartupSettings: vi.fn(),
  findMessage: vi.fn(), findMessageByIdempotencyKey: vi.fn(), createMessage: vi.fn(), regenerateMessage: vi.fn(),
  listMessages: vi.fn(), updateMessageContent: vi.fn(), approveMessage: vi.fn(), reviewMessage: vi.fn(),
  handoffMessage: vi.fn(), resetHandoff: vi.fn(), markMessageSent: vi.fn(), cancelMessage: vi.fn(),
  transitionCampaign: vi.fn(), recordActivity: vi.fn(), checkEntitlement: vi.fn(), recordMockUsage: vi.fn(),
}));

vi.mock('../src/config/env.js', () => ({ env: { get LLM_MODE() { return mocks.llmMode; } } }));
vi.mock('../src/repositories/outreach.repository.js', () => ({ outreachRepository: {
  findCampaign: mocks.findCampaign, findContact: mocks.findContact, findProspect: mocks.findProspect,
  findStartupSettings: mocks.findStartupSettings, findMessage: mocks.findMessage,
  findMessageByIdempotencyKey: mocks.findMessageByIdempotencyKey, createMessage: mocks.createMessage,
  regenerateMessage: mocks.regenerateMessage, listMessages: mocks.listMessages,
  updateMessageContent: mocks.updateMessageContent, approveMessage: mocks.approveMessage,
  reviewMessage: mocks.reviewMessage, handoffMessage: mocks.handoffMessage, resetHandoff: mocks.resetHandoff,
  markMessageSent: mocks.markMessageSent, cancelMessage: mocks.cancelMessage,
  transitionCampaign: mocks.transitionCampaign, recordActivity: mocks.recordActivity,
} }));
vi.mock('../src/services/usage.service.js', () => ({ usageService: {
  checkEntitlement: mocks.checkEntitlement, recordMockUsage: mocks.recordMockUsage,
} }));

import { messageService } from '../src/services/message.service.js';

const startupId = '507f1f77bcf86cd799439011';
const userId = startupId;
const campaignId = '507f1f77bcf86cd799439012';
const contactId = '507f1f77bcf86cd799439013';
const prospectId = '507f1f77bcf86cd799439014';
const messageId = '507f1f77bcf86cd799439015';
const now = new Date('2026-10-11T08:00:00.000Z');

function messageDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(messageId), startupId: new Types.ObjectId(startupId),
    campaignId: new Types.ObjectId(campaignId), prospectId: new Types.ObjectId(prospectId),
    decisionMakerId: new Types.ObjectId(contactId), step: 1, revision: 1,
    subject: 'A quick question', body: 'Hi Pat,\n\nWould a conversation be useful?\n\nBest,\nNaveen',
    approvalStatus: 'pending', status: 'draft', idempotencyKey: `draft:${campaignId}:${contactId}:1`,
    createdBy: new Types.ObjectId(userId), createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'), ...overrides,
  };
}

beforeEach(() => {
  mocks.llmMode = 'mock';
  mocks.campaign = { _id: new Types.ObjectId(campaignId), startupId: new Types.ObjectId(startupId), status: 'approved', name: 'Demo', icpId: new Types.ObjectId('507f1f77bcf86cd799439016') };
  mocks.contact = { _id: new Types.ObjectId(contactId), startupId: new Types.ObjectId(startupId), prospectId: new Types.ObjectId(prospectId), fullName: 'Pat Lee', businessEmail: 'pat@example.com', jobTitle: 'Ops Manager', outreachStatus: 'not_contacted' };
  mocks.prospect = { _id: new Types.ObjectId(prospectId), startupId: new Types.ObjectId(startupId), name: 'Sample Co', status: 'qualified', firmographics: { industry: 'Software' } };
  mocks.settings = { _id: new Types.ObjectId(startupId), settings: { productSummary: 'Scheduling software', senderName: 'Naveen' } };
  mocks.existing = null;
  mocks.message = messageDoc();
  mocks.findCampaign.mockReset().mockImplementation(async () => mocks.campaign);
  mocks.findContact.mockReset().mockImplementation(async () => mocks.contact);
  mocks.findProspect.mockReset().mockImplementation(async () => mocks.prospect);
  mocks.findStartupSettings.mockReset().mockImplementation(async () => mocks.settings);
  mocks.findMessage.mockReset().mockImplementation(async () => mocks.message);
  mocks.findMessageByIdempotencyKey.mockReset().mockImplementation(async () => mocks.existing);
  mocks.createMessage.mockReset().mockImplementation(async (input: any) => messageDoc(input));
  mocks.regenerateMessage.mockReset().mockImplementation(async (input: any) => messageDoc({ ...mocks.message, ...input, revision: 2, status: 'draft', approvalStatus: 'pending' }));
  mocks.listMessages.mockReset().mockResolvedValue({ items: [mocks.message], total: 1 });
  mocks.updateMessageContent.mockReset().mockImplementation(async (input: any) => messageDoc({ ...mocks.message, ...input, status: 'draft', approvalStatus: 'pending', approvedBy: undefined, approvedAt: undefined }));
  mocks.approveMessage.mockReset().mockImplementation(async () => messageDoc({ ...mocks.message, approvalStatus: 'approved', status: 'ready', approvedBy: new Types.ObjectId(userId), approvedAt: now }));
  mocks.reviewMessage.mockReset().mockImplementation(async (input: any) => messageDoc({ ...mocks.message, approvalStatus: input.approvalStatus, status: 'draft' }));
  mocks.handoffMessage.mockReset().mockImplementation(async () => messageDoc({ ...mocks.message, approvalStatus: 'approved', status: 'handed_off', updatedAt: now }));
  mocks.resetHandoff.mockReset().mockResolvedValue({ matchedCount: 1 });
  mocks.markMessageSent.mockReset().mockImplementation(async (input: any) => messageDoc({ ...mocks.message, status: 'user_reported_sent', sentAt: input.sentAt }));
  mocks.cancelMessage.mockReset().mockImplementation(async () => messageDoc({ ...mocks.message, status: 'cancelled' }));
  mocks.transitionCampaign.mockReset().mockImplementation(async (input: any) => { mocks.campaign = { ...mocks.campaign, status: input.to }; return mocks.campaign; });
  mocks.recordActivity.mockReset().mockResolvedValue({});
  mocks.checkEntitlement.mockReset().mockResolvedValue({ allowed: true, used: 0, limit: null });
  mocks.recordMockUsage.mockReset().mockResolvedValue(undefined);
});

describe('messageService draft-first lifecycle', () => {
  const draftInput = { startupId, userId, plan: 'trial' as const, requestId: 'req-m5', campaignId, decisionMakerId: contactId, step: 1, regenerate: false };

  it('creates a local mock draft with server-owned tenant and relationship IDs', async () => {
    const result = await messageService.draft(draftInput);
    expect(result.created).toBe(true);
    expect(result.item).toMatchObject({ status: 'draft', approvalStatus: 'pending', step: 1, subject: expect.any(String), body: expect.stringContaining('Hi Pat') });
    expect(mocks.createMessage).toHaveBeenCalledWith(expect.objectContaining({
      startupId: expect.any(Types.ObjectId), campaignId: expect.any(Types.ObjectId), prospectId: expect.any(Types.ObjectId),
      decisionMakerId: expect.any(Types.ObjectId), idempotencyKey: `draft:${campaignId}:${contactId}:1`,
    }));
    expect(mocks.recordMockUsage).toHaveBeenCalledWith(expect.objectContaining({ requestId: 'req-m5' }), 'llm.draft_message@1');
  });

  it('coalesces concurrent identical requests into one draft creation', async () => {
    const [one, two] = await Promise.all([messageService.draft(draftInput), messageService.draft(draftInput)]);
    expect(mocks.createMessage).toHaveBeenCalledTimes(1);
    expect(one.item.id).toBe(two.item.id);
  });

  it('returns the existing draft idempotently without running the mock again', async () => {
    const prior = messageDoc();
    mocks.existing = prior;
    const result = await messageService.draft(draftInput);
    expect(result.created).toBe(false);
    expect(result.item.id).toBe(messageId);
    expect(mocks.createMessage).not.toHaveBeenCalled();
    expect(mocks.recordMockUsage).not.toHaveBeenCalled();
  });

  it('blocks drafting when the contact or prospect is do-not-contact', async () => {
    mocks.contact = { ...mocks.contact, outreachStatus: 'do_not_contact' };
    await expect(messageService.draft(draftInput)).rejects.toMatchObject({ status: 409, code: 'DO_NOT_CONTACT' });
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it('blocks drafting when a business email is missing', async () => {
    mocks.contact = { ...mocks.contact, businessEmail: undefined };
    await expect(messageService.draft(draftInput)).rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });
  });

  it('fails closed in live mode until an approved estimate and real adapter exist', async () => {
    mocks.llmMode = 'live';
    await expect(messageService.draft(draftInput)).rejects.toMatchObject({ status: 503, code: 'CAPABILITY_DISABLED' });
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });

  it('resets approval and clears approver fields when editing', async () => {
    mocks.message = messageDoc({ status: 'ready', approvalStatus: 'approved', approvedBy: userId, approvedAt: now });
    const result = await messageService.edit(startupId, messageId, { body: 'Updated message body' });
    expect(result).toMatchObject({ status: 'draft', approvalStatus: 'pending' });
    expect(mocks.updateMessageContent).toHaveBeenCalledWith(expect.objectContaining({ body: 'Updated message body' }));
  });

  it('does not approve a message until the campaign is approved', async () => {
    mocks.campaign = { ...mocks.campaign, status: 'pending_approval' };
    mocks.message = messageDoc();
    await expect(messageService.approve(startupId, messageId, userId)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(mocks.approveMessage).not.toHaveBeenCalled();
  });

  it('approves a valid message and records an activity event', async () => {
    mocks.message = messageDoc();
    const result = await messageService.approve(startupId, messageId, userId);
    expect(result).toMatchObject({ status: 'ready', approvalStatus: 'approved' });
    expect(mocks.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: 'message_approved' }));
  });

  it('returns handoff data without sending email and activates the campaign label', async () => {
    mocks.message = messageDoc({ status: 'ready', approvalStatus: 'approved' });
    const result = await messageService.handoff(startupId, messageId);
    expect(result.handoff).toMatchObject({ to: 'pat@example.com', subject: 'A quick question' });
    expect(result.message.status).toBe('handed_off');
    expect(mocks.transitionCampaign).toHaveBeenCalledWith(expect.objectContaining({ to: 'active' }));
    expect(mocks.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: 'handoff_requested' }));
  });

  it('blocks handoff after a prospect is marked do-not-contact', async () => {
    mocks.message = messageDoc({ status: 'ready', approvalStatus: 'approved' });
    mocks.prospect = { ...mocks.prospect, status: 'do_not_contact' };
    await expect(messageService.handoff(startupId, messageId)).rejects.toMatchObject({ status: 409, code: 'DO_NOT_CONTACT' });
    expect(mocks.handoffMessage).not.toHaveBeenCalled();
  });

  it('records sent status as founder-reported only', async () => {
    mocks.message = messageDoc({ status: 'handed_off', approvalStatus: 'approved', updatedAt: new Date('2026-10-11T07:00:00.000Z') });
    const result = await messageService.markSent(startupId, messageId, now);
    expect(result.status).toBe('user_reported_sent');
    expect(mocks.recordActivity).toHaveBeenCalledWith(expect.objectContaining({ activityType: 'message_user_reported_sent' }));
  });

  it('rejects marking a draft as sent', async () => {
    mocks.message = messageDoc();
    await expect(messageService.markSent(startupId, messageId)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(mocks.markMessageSent).not.toHaveBeenCalled();
  });
});
