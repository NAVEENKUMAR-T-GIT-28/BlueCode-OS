import { describe, expect, it } from 'vitest';
import { createCampaignSchema, updateCampaignSchema, listCampaignsQuerySchema } from '../src/validators/campaign.validator.js';
import { draftMessageSchema, editMessageSchema, listMessagesQuerySchema, markSentSchema } from '../src/validators/message.validator.js';

const campaignId = '507f1f77bcf86cd799439012';
const contactId = '507f1f77bcf86cd799439013';

describe('outreach contract validation', () => {
  it('rejects unknown campaign fields and non-email channels', () => {
    expect(createCampaignSchema.safeParse({ icpId: campaignId, name: 'Demo', channel: 'email', status: 'approved' }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ icpId: campaignId, name: 'Demo', channel: 'apollo' }).success).toBe(false);
  });

  it('requires campaign name for a patch and validates list filters', () => {
    expect(updateCampaignSchema.safeParse({}).success).toBe(false);
    expect(listCampaignsQuerySchema.safeParse({ status: 'running' }).success).toBe(false);
  });

  it('validates draft IDs, step range, and rejects client-owned fields', () => {
    expect(draftMessageSchema.safeParse({ campaignId, decisionMakerId: contactId, step: 1 }).success).toBe(true);
    expect(draftMessageSchema.safeParse({ campaignId, decisionMakerId: contactId, step: 6 }).success).toBe(false);
    expect(draftMessageSchema.safeParse({ campaignId, decisionMakerId: contactId, idempotencyKey: 'client' }).success).toBe(false);
  });

  it('requires at least one editable field and rejects unknown fields', () => {
    expect(editMessageSchema.safeParse({}).success).toBe(false);
    expect(editMessageSchema.safeParse({ body: 'Updated', status: 'ready' }).success).toBe(false);
    expect(editMessageSchema.safeParse({ body: 'Updated' }).success).toBe(true);
  });

  it('accepts an ISO sentAt and rejects malformed timestamps', () => {
    expect(markSentSchema.safeParse({ sentAt: '2026-10-11T08:00:00.000Z' }).success).toBe(true);
    expect(markSentSchema.safeParse({ sentAt: 'yesterday' }).success).toBe(false);
  });

  it('rejects unknown message query filters', () => {
    expect(listMessagesQuerySchema.safeParse({ status: 'draft', isAdmin: 'true' }).success).toBe(false);
  });
});
