import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { getUsageEstimate } from '../config/usage-estimates.js';
import { usageService } from './usage.service.js';
import { outreachRepository } from '../repositories/outreach.repository.js';
import { buildMockMessageDraft } from '../providers/ai/mock-message-drafter.js';
import { ApiError } from '../shared/api-error.js';
import { clock } from '../utils/clock.js';
import type { StartupPlan } from '../types/startup.js';
import type { MessageApprovalStatus, MessageStatus } from '../types/outreach.js';

const DRAFT_OPERATION = 'llm.draft_message@1';
type DraftOutcome = { item: any; created: boolean };
const draftFlights = new Map<string, Promise<DraftOutcome>>();

function id(value: unknown): string { return value === undefined || value === null ? '' : String(value); }
function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

function messageDto(doc: any) {
  return {
    id: id(doc._id), campaignId: id(doc.campaignId), prospectId: id(doc.prospectId),
    decisionMakerId: id(doc.decisionMakerId), step: doc.step, revision: doc.revision,
    ...(doc.subject !== undefined ? { subject: doc.subject } : {}), body: doc.body,
    approvalStatus: doc.approvalStatus, ...(doc.approvedBy ? { approvedBy: id(doc.approvedBy) } : {}),
    ...(doc.approvedAt ? { approvedAt: doc.approvedAt } : {}), status: doc.status,
    ...(doc.sentAt ? { sentAt: doc.sentAt } : {}), createdBy: id(doc.createdBy),
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

function assertNotSuppressed(prospect: any, contact: any) {
  if (prospect.status === 'do_not_contact' || contact.outreachStatus === 'do_not_contact') {
    throw new ApiError(409, 'DO_NOT_CONTACT', 'The prospect or contact is marked do-not-contact');
  }
}

function assertCanDraft(campaign: any) {
  if (['paused', 'completed', 'cancelled'].includes(campaign.status)) {
    throw new ApiError(409, 'INVALID_STATE', 'New drafts are not allowed for a paused or terminal campaign');
  }
}

async function loadMessageBundle(startupId: Types.ObjectId, messageIdValue: string) {
  const messageId = objectId(messageIdValue, 'message ID');
  const message = await outreachRepository.findMessage(startupId, messageId);
  if (!message) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
  const campaignId = new Types.ObjectId(id(message.campaignId));
  const contactId = new Types.ObjectId(id(message.decisionMakerId));
  const prospectId = new Types.ObjectId(id(message.prospectId));
  const [campaign, contact, prospect] = await Promise.all([
    outreachRepository.findCampaign(startupId, campaignId),
    outreachRepository.findContact(startupId, contactId),
    outreachRepository.findProspect(startupId, prospectId),
  ]);
  if (!campaign || !contact || !prospect || id(contact.prospectId) !== id(prospect._id)) {
    throw new ApiError(404, 'NOT_FOUND', 'Message not found');
  }
  return { message, campaign, contact, prospect, messageId };
}

async function draftContent(settings: any, contact: any, step: number) {
  if (env.LLM_MODE !== 'mock') {
    // No live LLM adapter or approved estimate exists yet. Fail closed before any provider I/O.
    getUsageEstimate(DRAFT_OPERATION);
    throw new ApiError(503, 'CAPABILITY_DISABLED', 'Live message drafting is not configured for this deployment', {
      capability: 'llm_draft_message', operation: DRAFT_OPERATION,
    });
  }
  const result = buildMockMessageDraft({
    fullName: contact.fullName,
    ...(settings?.productSummary ? { productSummary: settings.productSummary } : {}),
    ...(settings?.senderName ? { senderName: settings.senderName } : {}),
    ...(settings?.senderTitle ? { senderTitle: settings.senderTitle } : {}),
    step,
  });
  return result;
}

export const messageService = {
  async draft(input: {
    startupId: string; userId: string; plan: StartupPlan; requestId?: string;
    campaignId: string; decisionMakerId: string; step: number; regenerate: boolean;
  }): Promise<DraftOutcome> {
    const startupId = objectId(input.startupId, 'workspace ID');
    const campaignId = objectId(input.campaignId, 'campaign ID');
    const decisionMakerId = objectId(input.decisionMakerId, 'decision-maker ID');
    const key = `draft:${campaignId.toString()}:${decisionMakerId.toString()}:${input.step}`;
    const flightKey = `${startupId.toString()}:${key}`;
    const existingFlight = draftFlights.get(flightKey);
    if (existingFlight) {
      const result = await existingFlight;
      return { item: result.item, created: false };
    }

    const work = this.performDraft({ ...input, startupId, campaignId, decisionMakerId, key });
    draftFlights.set(flightKey, work);
    try {
      return await work;
    } finally {
      if (draftFlights.get(flightKey) === work) draftFlights.delete(flightKey);
    }
  },

  async performDraft(input: {
    startupId: Types.ObjectId; userId: string; plan: StartupPlan; requestId?: string;
    campaignId: Types.ObjectId; decisionMakerId: Types.ObjectId; step: number; regenerate: boolean; key: string;
  }): Promise<DraftOutcome> {
    const [campaign, contact, settings] = await Promise.all([
      outreachRepository.findCampaign(input.startupId, input.campaignId),
      outreachRepository.findContact(input.startupId, input.decisionMakerId),
      outreachRepository.findStartupSettings(input.startupId),
    ]);
    if (!campaign) throw new ApiError(422, 'VALIDATION_FAILED', 'The campaign must belong to this workspace', { path: 'campaignId' });
    if (!contact) throw new ApiError(422, 'VALIDATION_FAILED', 'The contact must belong to this workspace', { path: 'decisionMakerId' });
    if (!settings) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    assertCanDraft(campaign);
    const prospect = await outreachRepository.findProspect(input.startupId, new Types.ObjectId(id(contact.prospectId)));
    if (!prospect) throw new ApiError(422, 'VALIDATION_FAILED', 'The contact must reference a prospect in this workspace', { path: 'decisionMakerId' });
    assertNotSuppressed(prospect, contact);
    if (!contact.businessEmail) throw new ApiError(422, 'VALIDATION_FAILED', 'Add or enrich a business email before drafting', { path: 'decisionMakerId' });

    const existing = await outreachRepository.findMessageByIdempotencyKey(input.startupId, input.key);
    if (existing && !input.regenerate) return { item: messageDto(existing), created: false };
    if (existing && existing.approvalStatus === 'approved') {
      throw new ApiError(409, 'INVALID_STATE', 'An approved draft cannot be regenerated');
    }
    if (existing && existing.status !== 'draft') {
      throw new ApiError(409, 'INVALID_STATE', 'Only an unapproved draft can be regenerated');
    }

    await usageService.checkEntitlement(input.startupId.toString(), input.plan, 'emails');
    const content = await draftContent(settings.settings, contact, input.step);
    await usageService.recordMockUsage({
      startupId: input.startupId.toString(),
      ...(input.requestId ? { requestId: input.requestId } : {}),
      entityRef: { kind: 'campaign', id: input.campaignId.toString() },
    }, 'llm.draft_message@1');

    if (existing) {
      const updated = await outreachRepository.regenerateMessage({
        startupId: input.startupId, messageId: new Types.ObjectId(id(existing._id)), ...content,
      });
      if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Draft changed; refresh and retry');
      return { item: messageDto(updated), created: false };
    }

    try {
      const created = await outreachRepository.createMessage({
        startupId: input.startupId, campaignId: input.campaignId,
        prospectId: new Types.ObjectId(id(prospect._id)), decisionMakerId: input.decisionMakerId,
        step: input.step, revision: 1, ...content,
        approvalStatus: 'pending', status: 'draft', idempotencyKey: input.key,
        createdBy: objectId(input.userId, 'user ID'),
      });
      return { item: messageDto(created), created: true };
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const winner = await outreachRepository.findMessageByIdempotencyKey(input.startupId, input.key);
      if (!winner) throw error;
      return { item: messageDto(winner), created: false };
    }
  },

  async list(startupIdValue: string, query: {
    campaignId?: string; prospectId?: string; decisionMakerId?: string;
    approvalStatus?: MessageApprovalStatus; status?: MessageStatus; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const result = await outreachRepository.listMessages(startupId, {
      ...(query.campaignId ? { campaignId: objectId(query.campaignId, 'campaign ID') } : {}),
      ...(query.prospectId ? { prospectId: objectId(query.prospectId, 'prospect ID') } : {}),
      ...(query.decisionMakerId ? { decisionMakerId: objectId(query.decisionMakerId, 'decision-maker ID') } : {}),
      ...(query.approvalStatus ? { approvalStatus: query.approvalStatus } : {}),
      ...(query.status ? { status: query.status } : {}),
      sort: query.sort, page: query.page, limit: query.limit,
    });
    return { items: result.items.map(messageDto), meta: { page: query.page, limit: query.limit, total: result.total } };
  },

  async get(startupIdValue: string, messageIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const messageId = objectId(messageIdValue, 'message ID');
    const message = await outreachRepository.findMessage(startupId, messageId);
    if (!message) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
    return messageDto(message);
  },

  async edit(startupIdValue: string, messageIdValue: string, patch: { subject?: string; body?: string }) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const messageId = objectId(messageIdValue, 'message ID');
    const current = await outreachRepository.findMessage(startupId, messageId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
    if (!['draft', 'ready'].includes(current.status)) throw new ApiError(409, 'INVALID_STATE', 'Messages cannot be edited after handoff or cancellation');
    const updated = await outreachRepository.updateMessageContent({ startupId, messageId, ...patch });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Message status changed; refresh and retry');
    return messageDto(updated);
  },

  async approve(startupIdValue: string, messageIdValue: string, userIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const bundle = await loadMessageBundle(startupId, messageIdValue);
    if (!bundle.message.subject?.trim() || !bundle.message.body?.trim()) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'A non-empty subject and body are required before approval');
    }
    if (!['approved', 'active'].includes(bundle.campaign.status)) {
      throw new ApiError(409, 'INVALID_STATE', 'The campaign must be approved before approving messages');
    }
    assertNotSuppressed(bundle.prospect, bundle.contact);
    const updated = await outreachRepository.approveMessage({
      startupId, messageId: bundle.messageId, approvedBy: objectId(userIdValue, 'user ID'), approvedAt: clock.now(),
    });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Message is not awaiting approval or its state changed');
    await outreachRepository.recordActivity({
      startupId, prospectId: new Types.ObjectId(id(bundle.prospect._id)),
      campaignId: new Types.ObjectId(id(bundle.campaign._id)), messageId: bundle.messageId,
      activityType: 'message_approved', summary: 'A draft message was approved by a workspace member.',
      source: 'manual', occurredAt: clock.now(),
    });
    return messageDto(updated);
  },

  async reject(startupIdValue: string, messageIdValue: string, reason?: string) {
    // The frozen outreachMessages schema has no review-note field; reason is validated at the edge but not persisted.
    void reason;
    return this.review(startupIdValue, messageIdValue, 'rejected');
  },

  async requestRevision(startupIdValue: string, messageIdValue: string, note: string) {
    // The frozen outreachMessages schema has no review-note field; note is validated at the edge but not persisted.
    void note;
    return this.review(startupIdValue, messageIdValue, 'revision_requested');
  },

  async review(startupIdValue: string, messageIdValue: string, approvalStatus: 'rejected' | 'revision_requested') {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const messageId = objectId(messageIdValue, 'message ID');
    const current = await outreachRepository.findMessage(startupId, messageId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
    const updated = await outreachRepository.reviewMessage({ startupId, messageId, approvalStatus });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Only an unapproved draft can be rejected or returned for revision');
    return messageDto(updated);
  },

  async handoff(startupIdValue: string, messageIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const bundle = await loadMessageBundle(startupId, messageIdValue);
    if (bundle.message.approvalStatus !== 'approved') throw new ApiError(409, 'APPROVAL_REQUIRED', 'Approve this message before handoff');
    if (!['ready', 'handed_off'].includes(bundle.message.status)) throw new ApiError(409, 'INVALID_STATE', 'Message is not ready for handoff');
    if (!['approved', 'active'].includes(bundle.campaign.status)) throw new ApiError(409, 'INVALID_STATE', 'Campaign must be approved or active for handoff');
    assertNotSuppressed(bundle.prospect, bundle.contact);
    if (!bundle.contact.businessEmail || !bundle.message.subject?.trim() || !bundle.message.body?.trim()) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'A business email, subject, and body are required for handoff');
    }

    let message: any = bundle.message;
    if (bundle.message.status === 'ready') {
      const updated = await outreachRepository.handoffMessage(startupId, bundle.messageId);
      if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Message status changed; refresh and retry');
      message = updated;
    }
    if (bundle.campaign.status === 'approved') {
      const activated = await outreachRepository.transitionCampaign({
        startupId, campaignId: new Types.ObjectId(id(bundle.campaign._id)), from: ['approved'], to: 'active',
      });
      if (!activated) {
        const latest = await outreachRepository.findCampaign(startupId, new Types.ObjectId(id(bundle.campaign._id)));
        if (!latest || latest.status !== 'active') {
          // A failed campaign transition must not leave a newly handed-off message in a false state.
          if (bundle.message.status === 'ready') await outreachRepository.resetHandoff(startupId, bundle.messageId);
          throw new ApiError(409, 'INVALID_STATE', 'Campaign state changed during handoff; refresh and retry');
        }
      }
    }
    const latestCampaign = await outreachRepository.findCampaign(startupId, new Types.ObjectId(id(bundle.campaign._id)));
    if (!latestCampaign || !['approved', 'active'].includes(latestCampaign.status)) {
      if (bundle.message.status === 'ready') await outreachRepository.resetHandoff(startupId, bundle.messageId);
      throw new ApiError(409, 'INVALID_STATE', 'Campaign state changed during handoff; refresh and retry');
    }
    await outreachRepository.recordActivity({
      startupId, prospectId: new Types.ObjectId(id(bundle.prospect._id)),
      campaignId: new Types.ObjectId(id(bundle.campaign._id)), messageId: bundle.messageId,
      activityType: 'handoff_requested', summary: 'The founder requested an email-client handoff; sending is not confirmed.',
      source: 'manual', occurredAt: clock.now(),
    });
    return {
      message: messageDto(message),
      handoff: { to: bundle.contact.businessEmail, subject: bundle.message.subject, body: bundle.message.body },
    };
  },

  async markSent(startupIdValue: string, messageIdValue: string, requestedSentAt?: Date) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const bundle = await loadMessageBundle(startupId, messageIdValue);
    if (bundle.message.status !== 'handed_off') throw new ApiError(409, 'INVALID_STATE', 'Only a handed-off message can be marked as sent');
    const sentAt = requestedSentAt ?? clock.now();
    if (sentAt.getTime() > clock.now().getTime() || sentAt.getTime() < new Date(bundle.message.updatedAt).getTime()) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'sentAt must not be in the future or before handoff');
    }
    const updated = await outreachRepository.markMessageSent({ startupId, messageId: bundle.messageId, sentAt });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Message status changed; refresh and retry');
    await outreachRepository.recordActivity({
      startupId, prospectId: new Types.ObjectId(id(bundle.prospect._id)),
      campaignId: new Types.ObjectId(id(bundle.campaign._id)), messageId: bundle.messageId,
      activityType: 'message_user_reported_sent', summary: 'The founder reported that they sent the message; delivery is not confirmed.',
      source: 'manual', occurredAt: clock.now(),
    });
    return messageDto(updated);
  },

  async cancel(startupIdValue: string, messageIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const messageId = objectId(messageIdValue, 'message ID');
    const current = await outreachRepository.findMessage(startupId, messageId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Message not found');
    if (!['draft', 'ready'].includes(current.status as MessageStatus)) {
      throw new ApiError(409, 'INVALID_STATE', 'A message can only be cancelled before handoff');
    }
    const updated = await outreachRepository.cancelMessage(startupId, messageId);
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Message status changed; refresh and retry');
    return messageDto(updated);
  },
  async isContactSuppressed(startupIdValue: string, prospectIdValue: string, decisionMakerIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const prospectId = objectId(prospectIdValue, 'prospect ID');
    const decisionMakerId = objectId(decisionMakerIdValue, 'decision-maker ID');
    const [prospect, contact] = await Promise.all([
      outreachRepository.findProspect(startupId, prospectId),
      outreachRepository.findContact(startupId, decisionMakerId),
    ]);
    if (!prospect || !contact || id(contact.prospectId) !== id(prospect._id)) {
      throw new ApiError(404, 'NOT_FOUND', 'Contact not found');
    }
    return prospect.status === 'do_not_contact' || contact.outreachStatus === 'do_not_contact';
  },

  async getReplyContext(startupIdValue: string, messageIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const bundle = await loadMessageBundle(startupId, messageIdValue);
    // loadMessageBundle verifies tenant ownership and contact-to-prospect consistency.
    return { ...messageDto(bundle.message), prospectId: id(bundle.prospect._id), decisionMakerId: id(bundle.contact._id) };
  },

  async cancelUnsentForProspect(startupIdValue: string, prospectIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const prospectId = objectId(prospectIdValue, 'prospect ID');
    return outreachRepository.cancelUnsentMessagesForProspect(startupId, prospectId);
  },

  async listFollowupCandidates(startupIdValue: string, cutoff: Date) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const rows = await outreachRepository.listFollowupCandidates(startupId, cutoff, 100);
    const items: Array<{ messageId: string; prospectId: string; decisionMakerId: string; updatedAt: Date }> = [];
    for (const row of rows) {
      const prospect = await outreachRepository.findProspect(startupId, new Types.ObjectId(id(row.prospectId)));
      const contact = await outreachRepository.findContact(startupId, new Types.ObjectId(id(row.decisionMakerId)));
      if (!prospect || !contact || prospect.status === 'do_not_contact' || contact.outreachStatus === 'do_not_contact') continue;
      items.push({
        messageId: id(row._id),
        prospectId: id(row.prospectId),
        decisionMakerId: id(row.decisionMakerId),
        updatedAt: new Date(row.updatedAt),
      });
    }
    return items;
  },

  async latestMessageRoute(startupIdValue: string, prospectIdValue: string, decisionMakerIdValue?: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const prospectId = objectId(prospectIdValue, 'prospect ID');
    const decisionMakerId = decisionMakerIdValue ? objectId(decisionMakerIdValue, 'decision-maker ID') : undefined;
    const result = await outreachRepository.listMessages(startupId, {
      prospectId,
      ...(decisionMakerId ? { decisionMakerId } : {}),
      sort: '-createdAt', page: 1, limit: 1,
    });
    return result.items[0] ? `/messages/${id(result.items[0]._id)}` : '/messages';
  },
};
