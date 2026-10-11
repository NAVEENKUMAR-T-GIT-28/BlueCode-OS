import { Types } from 'mongoose';
import { nextBestActionRepository } from '../repositories/next-best-action.repository.js';
import { activityQueryService } from './activity-query.service.js';
import { messageService } from './message.service.js';
import { prospectService } from './prospect.service.js';
import { ApiError } from '../shared/api-error.js';
import { clock } from '../utils/clock.js';
import type { ReplyIntent } from '../providers/ai/mock-reply-classifier.js';

const FOLLOWUP_DAYS = 3; // Frozen BACKEND_ARCHITECTURE §7.9 default.
const id = (value: unknown): string => value === undefined || value === null ? '' : String(value);
type ActionType = 'follow_up' | 'send_reply' | 'share_information' | 'book_meeting' | 'nurture' | 'stop_outreach' | 'review_prospect';
type Priority = 'low' | 'medium' | 'high';

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

function actionDto(doc: any, now: Date) {
  const expiry = doc.expiresAt ? new Date(doc.expiresAt).getTime() : Number.NaN;
  const expired = (doc.status === 'pending' || doc.status === 'accepted') && Number.isFinite(expiry) && expiry <= now.getTime();
  return {
    id: id(doc._id), prospectId: id(doc.prospectId),
    ...(doc.decisionMakerId ? { decisionMakerId: id(doc.decisionMakerId) } : {}),
    actionType: doc.actionType, title: doc.title, reason: doc.reason, priority: doc.priority,
    status: expired ? 'expired' : doc.status,
    ...(doc.dueAt ? { dueAt: doc.dueAt } : {}), ...(doc.expiresAt ? { expiresAt: doc.expiresAt } : {}),
    ...(doc.basedOnActivityIds ? { basedOnActivityIds: doc.basedOnActivityIds.map(id) } : {}),
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };
}

export function actionForReply(intent: ReplyIntent, confidence: number, now: Date) {
  const dueAt = new Date(now.getTime() + FOLLOWUP_DAYS * 86_400_000);
  const actualIntent: ReplyIntent = confidence < 0.6 ? 'other' : intent;
  const templates: Partial<Record<ReplyIntent, { actionType: ActionType; title: string; reason: string; priority: Priority; dueAt?: Date }>> = {
    interested: { actionType: 'book_meeting', title: 'Review meeting availability', reason: 'The logged reply indicates interest. Review the context and arrange a meeting manually.', priority: 'high' },
    buying_interest: { actionType: 'book_meeting', title: 'Review meeting availability', reason: 'The logged reply indicates buying interest. Review the context and arrange a meeting manually.', priority: 'high' },
    not_now: { actionType: 'nurture', title: 'Revisit this prospect later', reason: 'The logged reply suggests the timing is not right; decide when a human follow-up is appropriate.', priority: 'medium', dueAt },
    wrong_person: { actionType: 'review_prospect', title: 'Review the right contact', reason: 'The logged reply indicates this may not be the correct contact.', priority: 'medium' },
    referral: { actionType: 'review_prospect', title: 'Review the referred contact', reason: 'The logged reply refers to another person; verify the contact before taking action.', priority: 'medium' },
    objection: { actionType: 'send_reply', title: 'Review and respond to the objection', reason: 'Review the recorded objection and prepare a human-approved response.', priority: 'high' },
    out_of_office: { actionType: 'follow_up', title: 'Review a later follow-up', reason: 'The reply appears to be an out-of-office response. Check for a return date before following up.', priority: 'low', dueAt },
    other: { actionType: 'review_prospect', title: 'Review the logged reply', reason: 'The reply intent is unclear or below the confidence threshold; review it manually.', priority: 'medium' },
  };
  return templates[actualIntent] ?? null;
}

function sortByPriority<T extends { priority: string; dueAt?: Date; createdAt?: Date }>(items: T[]): T[] {
  const rank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...items].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9)
    || ((a.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.dueAt?.getTime() ?? Number.MAX_SAFE_INTEGER))
    || ((b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)));
}

export const nextBestActionService = {
  async createFromReply(input: {
    startupId: string; prospectId: string; decisionMakerId?: string; intent: ReplyIntent;
    confidence: number; basedOnActivityId: string;
  }) {
    const spec = actionForReply(input.intent, input.confidence, clock.now());
    if (!spec) return null;
    const startupId = objectId(input.startupId, 'workspace ID');
    const prospectId = objectId(input.prospectId, 'prospect ID');
    const prospect = await prospectService.findRequired(startupId, input.prospectId);
    if (prospect.status === 'do_not_contact') return null;
    if (input.decisionMakerId && await messageService.isContactSuppressed(input.startupId, input.prospectId, input.decisionMakerId)) return null;
    const basedOnActivityId = objectId(input.basedOnActivityId, 'activity ID');
    const existingEvidence = await nextBestActionRepository.findActionBasedOnActivity({
      startupId, prospectId, actionType: spec.actionType, activityId: basedOnActivityId,
    });
    if (existingEvidence) return null;
    const saved = await nextBestActionRepository.upsertPending({
      startupId, prospectId,
      ...(input.decisionMakerId ? { decisionMakerId: objectId(input.decisionMakerId, 'decision-maker ID') } : {}),
      actionType: spec.actionType, title: spec.title, reason: spec.reason, priority: spec.priority,
      ...(spec.dueAt ? { dueAt: spec.dueAt } : {}), basedOnActivityIds: [basedOnActivityId],
    });
    return saved.created ? actionDto(saved.item, clock.now()) : null;
  },

  async refreshForStartup(startupIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const now = clock.now();
    const cutoff = new Date(now.getTime() - FOLLOWUP_DAYS * 86_400_000);
    const candidates = await messageService.listFollowupCandidates(startupIdValue, cutoff);
    for (const candidate of candidates) {
      const outbound = await activityQueryService.findLatestOutboundActivity(startupIdValue, candidate.messageId);
      if (!outbound) continue; // Evidence must be a recorded handoff or founder-reported-sent event.
      if (new Date(outbound.occurredAt).getTime() > cutoff.getTime()) continue;
      if (await activityQueryService.hasReplyAfter(startupIdValue, candidate.prospectId, new Date(outbound.occurredAt))) continue;
      const basedOnActivityId = objectId(id(outbound._id), 'activity ID');
      if (await nextBestActionRepository.findActionBasedOnActivity({
        startupId, prospectId: objectId(candidate.prospectId, 'prospect ID'), actionType: 'follow_up', activityId: basedOnActivityId,
      })) continue;
      await nextBestActionRepository.upsertPending({
        startupId,
        prospectId: objectId(candidate.prospectId, 'prospect ID'),
        ...(candidate.decisionMakerId ? { decisionMakerId: objectId(candidate.decisionMakerId, 'decision-maker ID') } : {}),
        actionType: 'follow_up', title: 'Review whether a follow-up is appropriate',
        reason: 'An email-client handoff or founder-reported send was recorded more than three days ago and no reply has been logged since. Review the context before acting.',
        priority: 'medium', dueAt: now, basedOnActivityIds: [basedOnActivityId],
      });
    }
  },

  async list(startupIdValue: string, query: { status: 'pending' | 'accepted' | 'dismissed' | 'completed' | 'expired'; prospectId?: string; sort: 'priority' }) {
    await this.refreshForStartup(startupIdValue);
    const startupId = objectId(startupIdValue, 'workspace ID');
    const now = clock.now();
    const docs = await nextBestActionRepository.listActions({
      startupId,
      status: query.status,
      ...(query.prospectId ? { prospectId: objectId(query.prospectId, 'prospect ID') } : {}),
      now,
      limit: 100,
    });
    const mapped = docs.map((doc: any) => actionDto(doc, now));
    const filtered = mapped.filter((item: any) => item.status === query.status);
    return { items: sortByPriority(filtered), meta: { limit: 100, total: filtered.length } };
  },

  async accept(startupIdValue: string, actionIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const actionId = objectId(actionIdValue, 'next-action ID');
    const current = await nextBestActionRepository.findById(startupId, actionId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Next action not found');
    if (actionDto(current, clock.now()).status !== 'pending' || current.status !== 'pending') {
      throw new ApiError(409, 'INVALID_STATE', 'Only a pending, non-expired action can be accepted');
    }
    const outboundKinds = new Set(['follow_up', 'send_reply', 'share_information', 'book_meeting', 'nurture']);
    if (outboundKinds.has(String(current.actionType))) {
      const prospect = await prospectService.findRequired(startupId, id(current.prospectId));
      if (prospect.status === 'do_not_contact') throw new ApiError(409, 'DO_NOT_CONTACT', 'Do-not-contact prospects cannot have outreach actions accepted');
      if (current.decisionMakerId && await messageService.isContactSuppressed(startupIdValue, id(current.prospectId), id(current.decisionMakerId))) {
        throw new ApiError(409, 'DO_NOT_CONTACT', 'Do-not-contact contacts cannot have outreach actions accepted');
      }
    }
    const updated = await nextBestActionRepository.transition({ startupId, actionId, from: ['pending'], to: 'accepted' });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Next action changed; refresh and retry');
    const route = await messageService.latestMessageRoute(
      startupIdValue, id(current.prospectId), current.decisionMakerId ? id(current.decisionMakerId) : undefined,
    );
    return { item: actionDto(updated, clock.now()), next: { route } };
  },

  async dismiss(startupIdValue: string, actionIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const actionId = objectId(actionIdValue, 'next-action ID');
    const current = await nextBestActionRepository.findById(startupId, actionId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Next action not found');
    if (actionDto(current, clock.now()).status === 'expired' || !['pending', 'accepted'].includes(String(current.status))) {
      throw new ApiError(409, 'INVALID_STATE', 'Only a pending or accepted non-expired action can be dismissed');
    }
    const updated = await nextBestActionRepository.transition({ startupId, actionId, from: ['pending', 'accepted'], to: 'dismissed' });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Next action changed; refresh and retry');
    return actionDto(updated, clock.now());
  },

  async complete(startupIdValue: string, actionIdValue: string) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const actionId = objectId(actionIdValue, 'next-action ID');
    const current = await nextBestActionRepository.findById(startupId, actionId);
    if (!current) throw new ApiError(404, 'NOT_FOUND', 'Next action not found');
    if (actionDto(current, clock.now()).status === 'expired' || !['pending', 'accepted'].includes(String(current.status))) {
      throw new ApiError(409, 'INVALID_STATE', 'Only a pending or accepted non-expired action can be completed');
    }
    const updated = await nextBestActionRepository.transition({ startupId, actionId, from: ['pending', 'accepted'], to: 'completed' });
    if (!updated) throw new ApiError(409, 'INVALID_STATE', 'Next action changed; refresh and retry');
    return actionDto(updated, clock.now());
  },
};
