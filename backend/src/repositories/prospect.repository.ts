import { Types, type PipelineStage } from 'mongoose';
import { Prospect } from '../models/prospect.model.js';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { LeadScore } from '../models/lead-score.model.js';
import { BuyingSignal } from '../models/buying-signal.model.js';
import type { ProspectListQuery, ProspectStatus } from '../types/prospect.js';
import { salesActivityRepository } from './sales-activity.repository.js';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function latestScoreLookup(scoredAgainstIcpId?: string): PipelineStage {
  const icpExpression = scoredAgainstIcpId
    ? { $eq: ['$icpId', new Types.ObjectId(scoredAgainstIcpId)] }
    : { $eq: ['$icpId', '$$originIcpId'] };
  return {
    $lookup: {
      from: 'leadScores',
      let: { prospectId: '$_id', startupId: '$startupId', originIcpId: '$icpId' },
      pipeline: [
        { $match: { $expr: { $and: [
          { $eq: ['$startupId', '$$startupId'] },
          { $eq: ['$prospectId', '$$prospectId'] },
          icpExpression,
        ] } } },
        { $sort: { scoredAt: -1, _id: -1 } },
        { $limit: 1 },
      ],
      as: '_scoreDocs',
    },
  };
}

export const prospectRepository = {
  async list(startupId: Types.ObjectId, query: ProspectListQuery) {
    const match: Record<string, unknown> = { startupId };
    if (query.icpId) match.icpId = new Types.ObjectId(query.icpId);
    if (query.status) match.status = query.status;
    if (query.q) {
      const prefix = new RegExp(`^${escapeRegex(query.q)}`, 'i');
      match.$or = [{ name: prefix }, { domain: prefix }];
    }

    // The first stage scopes every aggregate to the authenticated tenant.
    const base: PipelineStage[] = [
      { $match: match },
      latestScoreLookup(query.scoredAgainstIcpId ?? query.icpId),
      { $addFields: { _latestScore: { $arrayElemAt: ['$_scoreDocs', 0] } } },
    ];
    if (query.scoredAgainstIcpId) base.push({ $match: { _latestScore: { $exists: true } } });
    if (!query.includeLow) base.push({ $match: { '_latestScore.category': { $ne: 'low' } } });
    if (query.category?.length) base.push({ $match: { '_latestScore.category': { $in: query.category } } });
    if (query.minScore !== undefined) base.push({ $match: { '_latestScore.score': { $gte: query.minScore } } });

    const sort: Record<string, 1 | -1> = query.sort === 'score'
      ? { '_latestScore.score': 1, createdAt: -1 }
      : query.sort === '-score'
        ? { '_latestScore.score': -1, createdAt: -1 }
        : query.sort === 'createdAt'
          ? { createdAt: 1, _id: 1 }
          : query.sort === 'name'
            ? { name: 1, _id: 1 }
            : { createdAt: -1, _id: -1 };

    const [countRows, rows] = await Promise.all([
      Prospect.aggregate([...base, { $count: 'total' }]).exec(),
      Prospect.aggregate([...base, { $sort: sort }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, { $project: { _scoreDocs: 0 } }]).exec(),
    ]);
    return { items: rows, total: (countRows[0] as { total?: number } | undefined)?.total ?? 0 };
  },

  findById(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return Prospect.findOne({ _id: prospectId, startupId });
  },

  findMany(startupId: Types.ObjectId, prospectIds: Types.ObjectId[]) {
    return Prospect.find({ startupId, _id: { $in: prospectIds } });
  },

  transitionStatus(input: { startupId: Types.ObjectId; prospectId: Types.ObjectId; fromStatus: ProspectStatus; toStatus: ProspectStatus }) {
    return Prospect.findOneAndUpdate(
      { _id: input.prospectId, startupId: input.startupId, status: input.fromStatus },
      { $set: { status: input.toStatus } }, { new: true, runValidators: true },
    );
  },

  updateContactDnc(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    return DecisionMaker.updateMany({ startupId, prospectId }, { $set: { outreachStatus: 'do_not_contact' } });
  },

  async detailRelated(startupId: Types.ObjectId, prospectId: Types.ObjectId) {
    const [scoreRows, signals, contacts, recentActivity] = await Promise.all([
      LeadScore.aggregate([
        { $match: { startupId, prospectId } },
        { $sort: { scoredAt: -1, _id: -1 } },
        { $group: { _id: '$icpId', latest: { $first: '$$ROOT' } } },
        { $sort: { 'latest.scoredAt': -1 } },
      ]).exec(),
      BuyingSignal.find({ startupId, prospectId, status: 'active' }).sort({ detectedAt: -1 }).lean(),
      DecisionMaker.find({ startupId, prospectId }).sort({ createdAt: -1 }).lean(),
      salesActivityRepository.listRecent(startupId, prospectId, 20),
    ]);
    return { scoreRows, signals, contacts, recentActivity };
  },
};
