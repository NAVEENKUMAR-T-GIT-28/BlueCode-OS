import { Types } from 'mongoose';
import { ApiError } from '../shared/api-error.js';
import { Prospect } from '../models/prospect.model.js';
import { scoringRepository } from '../repositories/scoring.repository.js';
import { scoreDeterministic, type ScoreCriteria, type ScoreFirmographics } from './deterministic-score.js';
import { clock } from '../utils/clock.js';

const SIGNAL_STALE_DAYS = 45;
const SCORING_VERSION = 'deterministic-v1';

function toId(value: unknown): string { return value === undefined || value === null ? '' : String(value); }

function scoreDto(doc: any) {
  return {
    id: toId(doc._id),
    prospectId: toId(doc.prospectId),
    icpId: toId(doc.icpId),
    score: doc.score,
    category: doc.category,
    coverage: doc.coverage,
    breakdown: doc.breakdown,
    explanation: doc.explanation,
    explanationSource: doc.explanationSource,
    scoringVersion: doc.scoringVersion,
    icpVersion: doc.icpVersion,
    scoredAt: doc.scoredAt,
    createdAt: doc.createdAt,
  };
}

function toCriteria(value: any): ScoreCriteria {
  if (value && typeof value.toObject === 'function') return value.toObject() as ScoreCriteria;
  return (value ?? {}) as ScoreCriteria;
}

export const scoringService = {
  async scoreMany(startupIdValue: string, input: { prospectIds: string[]; icpId: string }) {
    if (!Types.ObjectId.isValid(input.icpId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
    const startupId = new Types.ObjectId(startupIdValue);
    const icpId = new Types.ObjectId(input.icpId);
    const icp = await scoringRepository.findIcp(startupId, icpId);
    if (!icp) throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    if (!icp.isActive) throw new ApiError(409, 'INVALID_STATE', 'Archived ICPs cannot be used for new scoring');

    const uniqueIds = [...new Set(input.prospectIds)];
    const prospectIds = uniqueIds.map(value => new Types.ObjectId(value));
    const prospects = await scoringRepository.findProspects(startupId, prospectIds);
    const found = new Set(prospects.map(prospect => String(prospect._id)));
    const invalidProspectIds = uniqueIds.filter(value => !found.has(value));
    // Validate every id before inserting any scores. A mixed foreign-tenant batch writes nothing.
    if (invalidProspectIds.length) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'One or more prospects do not belong to this workspace', { invalidProspectIds });
    }

    const now = clock.now();
    const [contactRows, signalRows] = await Promise.all([
      scoringRepository.listContactTitles(startupId, prospectIds),
      scoringRepository.listRecentActiveSignals(startupId, prospectIds, new Date(now.getTime() - SIGNAL_STALE_DAYS * 24 * 60 * 60 * 1000)),
    ]);
    const contactTitles = new Map<string, string[]>();
    for (const contact of contactRows) {
      const key = String(contact.prospectId);
      const rows = contactTitles.get(key) ?? [];
      if (typeof contact.jobTitle === 'string') rows.push(contact.jobTitle);
      contactTitles.set(key, rows);
    }
    const signalCounts = new Map<string, number>();
    for (const signal of signalRows) {
      const key = String(signal.prospectId);
      signalCounts.set(key, (signalCounts.get(key) ?? 0) + 1);
    }
    const criteria = toCriteria(icp.criteria);
    const scoredAt = now;
    const items = [];
    for (const prospect of prospects) {
      const prospectId = String(prospect._id);
      const result = scoreDeterministic({
        // exactOptionalPropertyTypes: the key must be ABSENT (not undefined) when missing.
        // Conditional spread omits it entirely; cast strips the Mongoose `| null` annotation.
        ...(prospect.firmographics != null
          ? { firmographics: prospect.firmographics as ScoreFirmographics }
          : {}),
        criteria,
        contactJobTitles: contactTitles.get(prospectId) ?? [],
        activeSignalCount: signalCounts.get(prospectId) ?? 0,
      });
      const score = await scoringRepository.insertScore({
        startupId,
        prospectId: prospect._id,
        icpId,
        score: result.score,
        category: result.category,
        coverage: result.coverage,
        breakdown: result.breakdown,
        explanation: result.explanation,
        scoringVersion: SCORING_VERSION,
        icpVersion: icp.criteriaVersion,
        scoredAt,
      });
      // scoreDto already includes prospectId; no need to pass it separately.
      items.push({ ...scoreDto(score) });
    }
    return { scored: items.length, items };
  },

  async getScores(startupIdValue: string, prospectIdValue: string, query: {
    icpId?: string; history: boolean; page: number; limit: number;
  }) {
    if (!Types.ObjectId.isValid(prospectIdValue)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed prospect ID');
    const startupId = new Types.ObjectId(startupIdValue);
    const prospectId = new Types.ObjectId(prospectIdValue);
    // The prospect is looked up under startupId first, so foreign IDs remain indistinguishable from missing IDs.
    const prospect = await Prospect.findOne({ _id: prospectId, startupId }).select('_id icpId').lean();
    if (!prospect) throw new ApiError(404, 'NOT_FOUND', 'Prospect not found');

    let icpId: Types.ObjectId | undefined;
    if (query.icpId) {
      if (!Types.ObjectId.isValid(query.icpId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
      icpId = new Types.ObjectId(query.icpId);
      const icp = await scoringRepository.findIcp(startupId, icpId);
      if (!icp) throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    }

    if (query.history) {
      const result = await scoringRepository.listHistory({ startupId, prospectId, ...(icpId ? { icpId } : {}), page: query.page, limit: query.limit });
      return { history: true as const, data: result.items.map(scoreDto), meta: { page: query.page, limit: query.limit, total: result.total } };
    }

    // Without icpId, the API returns the origin-ICP score for consistency with Prospect.latestScore.
    const selectedIcpId = icpId ?? prospect.icpId;
    const latest = await scoringRepository.findLatest(startupId, prospectId, selectedIcpId);
    if (!latest) throw new ApiError(404, 'NOT_FOUND', 'Score not found');
    return { history: false as const, data: scoreDto(latest) };
  },
};
