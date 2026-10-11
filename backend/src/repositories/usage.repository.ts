import mongoose, { Types, type ClientSession } from 'mongoose';
import { Startup } from '../models/startup.model.js';
import { UsageRecord } from '../models/usage-record.model.js';
import { Prospect } from '../models/prospect.model.js';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { Icp } from '../models/icp.model.js';
import type { UsageProvider, UsageRecordQuery, UsageStatus, UsageCostType, UsageEntityRef } from '../types/usage.js';

export interface UsageRecordInput {
  startupId: Types.ObjectId;
  provider: UsageProvider;
  operation: string;
  status: UsageStatus;
  creditsConsumed?: number;
  costAmount?: number;
  costType: UsageCostType;
  errorCode?: string;
  requestId?: string;
  entityRef?: UsageEntityRef;
  occurredAt: Date;
}

export const usageRepository = {
  reserveBudget(startupId: Types.ObjectId, estimatePaise: number) {
    return Startup.findOneAndUpdate(
      {
        _id: startupId,
        status: 'active',
        $expr: {
          $lte: [
            { $add: ['$spendCommitted', '$spendReserved', estimatePaise] },
            '$apiSpendCap',
          ],
        },
      },
      { $inc: { spendReserved: estimatePaise } },
      { new: true, runValidators: true },
    ).select('_id apiSpendCap spendCommitted spendReserved status plan trialEndsAt');
  },

  findStartup(startupId: Types.ObjectId) {
    return Startup.findById(startupId)
      .select('_id apiSpendCap spendCommitted spendReserved status plan trialEndsAt')
      .lean();
  },

  appendRecord(input: UsageRecordInput, session?: ClientSession) {
    const options = session ? { session } : {};
    return UsageRecord.create([input], options).then(rows => {
      const record = rows[0];
      if (!record) throw new Error('Usage record was not created');
      return record;
    });
  },

  async finalizeReservation(input: {
    startupId: Types.ObjectId;
    estimatePaise: number;
    committedCostPaise: number;
    record: UsageRecordInput;
  }) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const updated = await Startup.updateOne(
          { _id: input.startupId, spendReserved: { $gte: input.estimatePaise } },
          {
            $inc: {
              spendReserved: -input.estimatePaise,
              spendCommitted: input.committedCostPaise,
            },
          },
          { session },
        );
        if (updated.matchedCount !== 1) {
          throw new Error('Usage reservation counters are inconsistent; transaction aborted');
        }
        await this.appendRecord(input.record, session);
      });
    } finally {
      await session.endSession();
    }
  },

  async recoverReservedCounters() {
    const affected = await Startup.countDocuments({ spendReserved: { $gt: 0 } });
    if (affected > 0) {
      await Startup.updateMany(
        { spendReserved: { $gt: 0 } },
        { $set: { spendReserved: 0 } },
      );
    }
    return affected;
  },

  async listRecords(startupId: Types.ObjectId, query: UsageRecordQuery) {
    const filter: Record<string, unknown> = { startupId };
    if (query.provider) filter.provider = query.provider;
    if (query.operation) filter.operation = query.operation;
    if (query.status) filter.status = query.status;
    if (query.from || query.to) {
      const occurredAt: Record<string, Date> = {};
      if (query.from) occurredAt.$gte = query.from;
      if (query.to) occurredAt.$lte = query.to;
      filter.occurredAt = occurredAt;
    }

    const [items, total] = await Promise.all([
      UsageRecord.find(filter)
        .sort({ occurredAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
      UsageRecord.countDocuments(filter),
    ]);
    return { items, total };
  },

  async costTypeTotals(startupId: Types.ObjectId) {
    return UsageRecord.aggregate([
      { $match: { startupId, status: { $in: ['success', 'failed'] }, costAmount: { $gt: 0 } } },
      { $group: {
        _id: '$costType',
        total: { $sum: '$costAmount' },
      } },
    ]).exec() as Promise<Array<{ _id: UsageCostType; total: number }>>;
  },

  async entitlementCounts(startupId: Types.ObjectId) {
    const [prospects, dmSearches, emails, icps] = await Promise.all([
      Prospect.countDocuments({ startupId }),
      UsageRecord.countDocuments({
        startupId, provider: 'apollo', operation: 'apollo.people_search', status: 'success',
      }),
      UsageRecord.countDocuments({
        startupId, provider: 'llm', operation: { $in: ['llm.draft_message', 'llm.draft_message@1'] }, status: 'success',
      }),
      Icp.countDocuments({ startupId, isActive: true }),
    ]);
    return { prospects, dmSearches, emails, icps };
  },

  async countEntitlementUsage(startupId: Types.ObjectId, metric: 'prospects' | 'dmSearches' | 'emails' | 'icps') {
    switch (metric) {
      case 'prospects': return Prospect.countDocuments({ startupId });
      case 'dmSearches': return UsageRecord.countDocuments({
        startupId, provider: 'apollo', operation: 'apollo.people_search', status: 'success',
      });
      case 'emails': return UsageRecord.countDocuments({
        startupId, provider: 'llm', operation: { $in: ['llm.draft_message', 'llm.draft_message@1'] }, status: 'success',
      });
      case 'icps': return Icp.countDocuments({ startupId, isActive: true });
    }
  },
};
