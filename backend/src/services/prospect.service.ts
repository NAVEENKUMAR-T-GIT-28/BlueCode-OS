import { Types } from 'mongoose';
import { ApiError } from '../shared/api-error.js';
import { prospectRepository } from '../repositories/prospect.repository.js';
import { salesActivityRepository } from '../repositories/sales-activity.repository.js';
import { canTransitionProspect } from './prospect-state.js';
import { clock } from '../utils/clock.js';
import { discoveryService } from './discovery.service.js';
import type { ProspectListQuery, ProspectStatus } from '../types/prospect.js';

const SIGNAL_STALE_DAYS = 45;
const id = (value: unknown): string => value === undefined || value === null ? '' : String(value);

function scoreDto(score: any) {
  return {
    id: id(score._id), prospectId: id(score.prospectId), icpId: id(score.icpId),
    score: score.score, category: score.category, coverage: score.coverage,
    breakdown: score.breakdown, explanation: score.explanation,
    explanationSource: score.explanationSource, scoringVersion: score.scoringVersion,
    icpVersion: score.icpVersion, scoredAt: score.scoredAt, createdAt: score.createdAt,
  };
}

function prospectDto(doc: any, latestScore?: any) {
  const result: Record<string, unknown> = {
    id: id(doc._id), icpId: id(doc.icpId), name: doc.name, status: doc.status,
    createdAt: doc.createdAt, updatedAt: doc.updatedAt,
  };
  if (doc.apolloOrganizationId) result.apolloOrganizationId = doc.apolloOrganizationId;
  if (doc.domain) result.domain = doc.domain;
  if (doc.firmographics) result.firmographics = doc.firmographics;
  if (latestScore) result.latestScore = {
    icpId: id(latestScore.icpId), score: latestScore.score, category: latestScore.category,
    coverage: latestScore.coverage, scoredAt: latestScore.scoredAt,
  };
  return result;
}

function signalDto(signal: any, now = clock.now().getTime()) {
  const detectedAt = new Date(signal.detectedAt).getTime();
  const stale = Number.isFinite(detectedAt) && now - detectedAt > SIGNAL_STALE_DAYS * 24 * 60 * 60 * 1000;
  return {
    id: id(signal._id), prospectId: id(signal.prospectId),
    ...(signal.decisionMakerId ? { decisionMakerId: id(signal.decisionMakerId) } : {}),
    signalType: signal.signalType, description: signal.description, evidence: signal.evidence,
    confidence: signal.confidence, status: stale ? 'stale' : signal.status,
    detectedAt: signal.detectedAt, createdAt: signal.createdAt, updatedAt: signal.updatedAt,
  };
}

export const prospectService = {
  async search(input: {
    startupId: string;
    plan: import('../types/startup.js').StartupPlan;
    icpId: string;
    page: number;
    perPage: number;
    requestId?: string;
  }) {
    return discoveryService.search(input);
  },

  async list(startupId: string, query: ProspectListQuery) {
    const result = await prospectRepository.list(new Types.ObjectId(startupId), query);
    return {
      items: result.items.map((row: any) => prospectDto(row, row._latestScore)),
      meta: { page: query.page, limit: query.limit, total: result.total },
    };
  },

  async get(startupId: string, prospectId: string) {
    if (!Types.ObjectId.isValid(prospectId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const tenantId = new Types.ObjectId(startupId);
    const prospect = await prospectRepository.findById(tenantId, new Types.ObjectId(prospectId));
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');

    const related = await prospectRepository.detailRelated(tenantId, prospect._id);
    const scoreRows = related.scoreRows as Array<{ _id: Types.ObjectId; latest: any }>;
    const scores = scoreRows.map(row => ({ icpId: id(row._id), latest: scoreDto(row.latest) }));
    const originScore = scoreRows.find(row => String(row._id) === String(prospect.icpId))?.latest;
    return {
      prospect: prospectDto(prospect, originScore),
      scores,
      signals: related.signals.map(signal => signalDto(signal)),
      contacts: related.contacts.map((contact: any) => ({
        id: id(contact._id), prospectId: id(contact.prospectId), fullName: contact.fullName,
        ...(contact.jobTitle ? { jobTitle: contact.jobTitle } : {}),
        ...(contact.businessEmail ? { businessEmail: contact.businessEmail } : {}),
        ...(contact.linkedinUrl ? { linkedinUrl: contact.linkedinUrl } : {}),
        ...(contact.emailVerified !== undefined ? { emailVerified: contact.emailVerified } : {}),
        source: contact.source, outreachStatus: contact.outreachStatus,
        createdAt: contact.createdAt, updatedAt: contact.updatedAt,
      })),
      recentActivity: related.recentActivity.map((activity: any) => ({
        id: id(activity._id), prospectId: id(activity.prospectId), activityType: activity.activityType,
        summary: activity.summary,
        ...(activity.classification ? { classification: activity.classification } : {}),
        ...(activity.metadata ? { metadata: activity.metadata } : {}),
        occurredAt: activity.occurredAt, createdAt: activity.createdAt,
      })),
    };
  },

  async select(startupId: string, prospectIds: string[]) {
    const tenantId = new Types.ObjectId(startupId);
    const uniqueIds = [...new Set(prospectIds)];
    const objectIds = uniqueIds.map(value => new Types.ObjectId(value));
    const docs = await prospectRepository.findMany(tenantId, objectIds);
    const found = new Set(docs.map(item => String(item._id)));
    const missing = uniqueIds.filter(value => !found.has(value));
    // Foreign-tenant or missing ids reject the whole batch before any updates occur.
    if (missing.length) throw new ApiError(422, 'VALIDATION_FAILED', 'One or more prospects do not belong to this workspace', { invalidProspectIds: missing });

    const byId = new Map(docs.map(item => [String(item._id), item]));
    let updated = 0;
    const skipped: Array<{ id: string; reason: string }> = [];
    for (const prospectId of uniqueIds) {
      const item = byId.get(prospectId)!;
      if (item.status === 'qualified') { skipped.push({ id: prospectId, reason: 'already_qualified' }); continue; }
      if (item.status === 'do_not_contact') { skipped.push({ id: prospectId, reason: 'do_not_contact' }); continue; }
      if (!canTransitionProspect(item.status as ProspectStatus, 'qualified')) { skipped.push({ id: prospectId, reason: 'invalid_status' }); continue; }
      const changed = await prospectRepository.transitionStatus({
        startupId: tenantId, prospectId: item._id,
        fromStatus: item.status as ProspectStatus, toStatus: 'qualified',
      });
      if (!changed) { skipped.push({ id: prospectId, reason: 'state_changed' }); continue; }
      await salesActivityRepository.recordStatusChange({
        startupId: tenantId, prospectId: item._id,
        fromStatus: item.status as ProspectStatus, toStatus: 'qualified',
      });
      updated++;
    }
    return { updated, skipped };
  },

  async disqualify(startupId: string, prospectId: string, reason?: string) {
    const tenantId = new Types.ObjectId(startupId);
    const item = await this.findRequired(tenantId, prospectId);
    if (item.status === 'disqualified') return prospectDto(item);
    if (!canTransitionProspect(item.status as ProspectStatus, 'disqualified')) {
      throw new ApiError(409, 'INVALID_STATE', 'A do-not-contact prospect cannot be disqualified; clear do-not-contact first');
    }
    const changed = await prospectRepository.transitionStatus({
      startupId: tenantId, prospectId: item._id,
      fromStatus: item.status as ProspectStatus, toStatus: 'disqualified',
    });
    if (!changed) throw new ApiError(409, 'INVALID_STATE', 'Prospect status changed; refresh and retry');
    await salesActivityRepository.recordStatusChange({
      startupId: tenantId, prospectId: item._id,
      fromStatus: item.status as ProspectStatus, toStatus: 'disqualified', ...(reason !== undefined ? { reason } : {}),
    });
    return prospectDto(changed);
  },

  async markDoNotContact(startupId: string, prospectId: string, reason?: string) {
    const tenantId = new Types.ObjectId(startupId);
    const item = await this.findRequired(tenantId, prospectId);
    if (item.status === 'do_not_contact') {
      await prospectRepository.updateContactDnc(tenantId, item._id);
      return prospectDto(item);
    }
    if (!canTransitionProspect(item.status as ProspectStatus, 'do_not_contact')) {
      throw new ApiError(409, 'INVALID_STATE', 'Prospect cannot enter do-not-contact from its current state');
    }
    const changed = await prospectRepository.transitionStatus({
      startupId: tenantId, prospectId: item._id,
      fromStatus: item.status as ProspectStatus, toStatus: 'do_not_contact',
    });
    if (!changed) throw new ApiError(409, 'INVALID_STATE', 'Prospect status changed; refresh and retry');
    await prospectRepository.updateContactDnc(tenantId, item._id);
    await salesActivityRepository.recordStatusChange({
      startupId: tenantId, prospectId: item._id,
      fromStatus: item.status as ProspectStatus, toStatus: 'do_not_contact', ...(reason !== undefined ? { reason } : {}),
    });
    return prospectDto(changed);
  },

  async clearDoNotContact(startupId: string, prospectId: string, reason: string) {
    const tenantId = new Types.ObjectId(startupId);
    const item = await this.findRequired(tenantId, prospectId);
    if (item.status !== 'do_not_contact') throw new ApiError(409, 'INVALID_STATE', 'Prospect is not marked do-not-contact');
    const changed = await prospectRepository.transitionStatus({
      startupId: tenantId, prospectId: item._id, fromStatus: 'do_not_contact', toStatus: 'qualified',
    });
    if (!changed) throw new ApiError(409, 'INVALID_STATE', 'Prospect status changed; refresh and retry');
    await salesActivityRepository.recordStatusChange({
      startupId: tenantId, prospectId: item._id,
      fromStatus: 'do_not_contact', toStatus: 'qualified', reason,
    });
    // Individual contacts remain DNC until their own state is explicitly reviewed.
    return prospectDto(changed);
  },

  async findRequired(startupId: Types.ObjectId, prospectId: string) {
    if (!Types.ObjectId.isValid(prospectId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const item = await prospectRepository.findById(startupId, new Types.ObjectId(prospectId));
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');
    return item;
  },
};
