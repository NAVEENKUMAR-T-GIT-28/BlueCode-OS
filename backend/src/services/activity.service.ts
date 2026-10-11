import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { getUsageEstimate } from '../config/usage-estimates.js';
import { activityQueryService } from './activity-query.service.js';
import { nextBestActionService } from './next-action.service.js';
import { prospectService } from './prospect.service.js';
import { messageService } from './message.service.js';
import { salesActivityRepository } from '../repositories/sales-activity.repository.js';
import { usageService } from './usage.service.js';
import { ApiError } from '../shared/api-error.js';
import { clock } from '../utils/clock.js';
import { classifyMockReply, detectUnsubscribe, type ReplyClassification } from '../providers/ai/mock-reply-classifier.js';

const CLASSIFY_OPERATION = 'llm.classify_reply@1';
const id = (value: unknown): string => value === undefined || value === null ? '' : String(value);

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

function activityDto(doc: any) {
  return {
    id: id(doc._id), prospectId: id(doc.prospectId),
    ...(doc.campaignId ? { campaignId: id(doc.campaignId) } : {}),
    ...(doc.messageId ? { messageId: id(doc.messageId) } : {}),
    activityType: doc.activityType, summary: doc.summary,
    ...(doc.classification ? { classification: doc.classification } : {}),
    ...(doc.metadata ? { metadata: doc.metadata } : {}),
    occurredAt: doc.occurredAt, createdAt: doc.createdAt,
  };
}

function replyExcerpt(text: string): string {
  const compact = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return `Founder logged reply: ${compact}`.slice(0, 500);
}

async function classifyReply(input: {
  startupId: string; requestId?: string; prospectId: string; text: string;
}): Promise<ReplyClassification | null> {
  if (env.LLM_MODE !== 'mock') {
    // No live adapter or owner-approved cost estimate exists. Reply logging must still succeed.
    getUsageEstimate(CLASSIFY_OPERATION);
    return null;
  }
  const result = classifyMockReply(input.text);
  await usageService.recordMockUsage({
    startupId: input.startupId,
    ...(input.requestId ? { requestId: input.requestId } : {}),
    entityRef: { kind: 'prospect', id: input.prospectId },
  }, CLASSIFY_OPERATION);
  return result;
}

export const activityService = {
  async list(startupIdValue: string, query: {
    prospectId?: string; messageId?: string; type?: string[]; from?: string; to?: string; sort: '-occurredAt' | 'occurredAt';
  }) {
    const startupId = objectId(startupIdValue, 'workspace ID');
    const result = await salesActivityRepository.listActivities({
      startupId,
      ...(query.prospectId ? { prospectId: objectId(query.prospectId, 'prospect ID') } : {}),
      ...(query.messageId ? { messageId: objectId(query.messageId, 'message ID') } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.from ? { from: new Date(query.from) } : {}),
      ...(query.to ? { to: new Date(query.to) } : {}),
      sort: query.sort,
      limit: 100,
    });
    return result.map(activityDto);
  },

  async logReply(input: {
    startupId: string; requestId?: string; prospectId: string; messageId?: string; text: string;
  }) {
    const startupId = objectId(input.startupId, 'workspace ID');
    const prospectId = objectId(input.prospectId, 'prospect ID');
    let prospect: any;
    try {
      prospect = await prospectService.findRequired(startupId, input.prospectId);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') {
        throw new ApiError(422, 'VALIDATION_FAILED', 'The prospect must belong to this workspace', { path: 'prospectId' });
      }
      throw error;
    }
    let message: any | undefined;

    if (input.messageId) {
      try {
        message = await messageService.getReplyContext(input.startupId, input.messageId);
      } catch (error) {
        if (error instanceof ApiError && error.code === 'NOT_FOUND') {
          throw new ApiError(422, 'VALIDATION_FAILED', 'The message must belong to this workspace', { path: 'messageId' });
        }
        throw error;
      }
      if (message.prospectId !== prospectId.toString()) {
        throw new ApiError(422, 'VALIDATION_FAILED', 'The message must belong to the selected prospect', { path: 'messageId' });
      }
    }

    const now = clock.now();
    const reply = await salesActivityRepository.recordReplyLogged({
      startupId, prospectId,
      ...(message?.campaignId ? { campaignId: objectId(message.campaignId, 'campaign ID') } : {}),
      ...(input.messageId ? { messageId: objectId(input.messageId, 'message ID') } : {}),
      summary: replyExcerpt(input.text), occurredAt: now,
    });
    const effects: Array<{ type: string; id?: string; cancelledDrafts?: number }> = [];

    // Keyword unsubscribe protection is not dependent on classifier availability or output.
    const unsubscribe = detectUnsubscribe(input.text);
    if (unsubscribe) {
      await prospectService.markDoNotContact(input.startupId, input.prospectId, 'Unsubscribe language in a manually logged reply');
      const cancelledDrafts = await messageService.cancelUnsentForProspect(input.startupId, input.prospectId);
      effects.push({ type: 'do_not_contact_set', cancelledDrafts });
    }

    let classification: ReplyClassification | null = null;
    try {
      classification = await classifyReply({
        startupId: input.startupId,
        ...(input.requestId ? { requestId: input.requestId } : {}),
        prospectId: input.prospectId,
        text: input.text,
      });
    } catch {
      // The logged reply and any deterministic unsubscribe effect survive a classifier failure.
      classification = null;
    }
    if (unsubscribe) classification = { intent: 'unsubscribe', confidence: 0.99 };

    let classifiedActivity: any | null = null;
    if (classification) {
      const intent = classification.confidence < 0.6 ? 'other' : classification.intent;
      classifiedActivity = await salesActivityRepository.recordReplyClassified({
        startupId, prospectId,
        ...(message?.campaignId ? { campaignId: objectId(message.campaignId, 'campaign ID') } : {}),
        ...(input.messageId ? { messageId: objectId(input.messageId, 'message ID') } : {}),
        intent, confidence: classification.confidence,
        summary: `Manually logged reply classified as ${intent}.`, occurredAt: clock.now(),
      });
      if (intent !== 'unsubscribe' && prospect.status !== 'do_not_contact') {
        const action = await nextBestActionService.createFromReply({
          startupId: input.startupId,
          prospectId: input.prospectId,
          ...(message?.decisionMakerId ? { decisionMakerId: message.decisionMakerId } : {}),
          intent,
          confidence: classification.confidence,
          basedOnActivityId: id(classifiedActivity._id),
        });
        if (action) effects.push({ type: 'next_action_created', id: action.id });
      }
    }

    return {
      reply: activityDto(reply),
      classification: classifiedActivity ? activityDto(classifiedActivity) : null,
      effects,
    };
  },

  // Used by the NBA rules layer; keeps its repository reads behind the activity service.
  hasReplyAfter(startupId: string, prospectId: string, after: Date) {
    return activityQueryService.hasReplyAfter(startupId, prospectId, after);
  },
  findLatestOutboundActivity(startupId: string, messageId: string) {
    return activityQueryService.findLatestOutboundActivity(startupId, messageId);
  },
};
