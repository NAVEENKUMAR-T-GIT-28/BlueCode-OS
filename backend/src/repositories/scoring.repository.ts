import { Types } from 'mongoose';
import { Icp } from '../models/icp.model.js';
import { Prospect } from '../models/prospect.model.js';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { BuyingSignal } from '../models/buying-signal.model.js';
import { LeadScore } from '../models/lead-score.model.js';

export const scoringRepository = {
  findIcp(startupId: Types.ObjectId, icpId: Types.ObjectId) {
    return Icp.findOne({ _id: icpId, startupId });
  },

  findProspect(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return Prospect.findOne({ _id: prospectId, startupId }).select('_id icpId').lean();
  },

  findProspects(startupId: Types.ObjectId, prospectIds: Types.ObjectId[]) {
    // Tenant scope is part of the query; callers must validate the entire batch before writing.
    return Prospect.find({ startupId, _id: { $in: prospectIds } }).lean();
  },

  listContactTitles(startupId: Types.ObjectId, prospectIds: Types.ObjectId[]) {
    return DecisionMaker.find({
      startupId,
      prospectId: { $in: prospectIds },
      jobTitle: { $exists: true, $type: 'string', $ne: '' },
    }).select('prospectId jobTitle').lean();
  },

  listRecentActiveSignals(startupId: Types.ObjectId, prospectIds: Types.ObjectId[], since: Date) {
    return BuyingSignal.find({
      startupId,
      prospectId: { $in: prospectIds },
      status: 'active',
      detectedAt: { $gte: since },
    }).select('prospectId').lean();
  },

  insertScore(input: {
    startupId: Types.ObjectId;
    prospectId: Types.ObjectId;
    icpId: Types.ObjectId;
    score: number;
    category: 'hot' | 'high' | 'medium' | 'low';
    coverage: number;
    breakdown: Record<string, number>;
    explanation: string;
    scoringVersion: string;
    icpVersion: number;
    scoredAt: Date;
  }) {
    return LeadScore.create({ ...input, explanationSource: 'rules' });
  },

  findLatest(startupId: Types.ObjectId, prospectId: Types.ObjectId, icpId?: Types.ObjectId) {
    const filter: Record<string, unknown> = { startupId, prospectId };
    if (icpId) filter.icpId = icpId;
    return LeadScore.findOne(filter).sort({ scoredAt: -1, _id: -1 }).lean();
  },

  async listHistory(input: {
    startupId: Types.ObjectId;
    prospectId: Types.ObjectId;
    icpId?: Types.ObjectId;
    page: number;
    limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId: input.startupId, prospectId: input.prospectId };
    if (input.icpId) filter.icpId = input.icpId;
    const [items, total] = await Promise.all([
      LeadScore.find(filter).sort({ scoredAt: -1, _id: -1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(),
      LeadScore.countDocuments(filter),
    ]);
    return { items, total };
  },
};
