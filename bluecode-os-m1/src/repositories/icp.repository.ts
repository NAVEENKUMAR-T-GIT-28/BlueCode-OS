import type { Types } from 'mongoose';
import { Icp } from '../models/icp.model.js';

type Criteria = Record<string, string[] | undefined>;

export const icpRepository = {
  create(input: { startupId: Types.ObjectId; name: string; criteria: Criteria; createdBy: Types.ObjectId }) {
    return Icp.create({
      startupId: input.startupId,
      name: input.name,
      criteria: input.criteria,
      criteriaVersion: 1,
      isActive: true,
      createdBy: input.createdBy,
    });
  },

  countActive(startupId: Types.ObjectId) {
    return Icp.countDocuments({ startupId, isActive: true });
  },

  list(startupId: Types.ObjectId, query: {
    isActive?: boolean; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const filter: Record<string, unknown> = { startupId };
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    const sort = query.sort === 'createdAt' ? { createdAt: 1 as const } : { createdAt: -1 as const };
    return Promise.all([
      Icp.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
      Icp.countDocuments(filter),
    ]);
  },

  findById(startupId: Types.ObjectId, id: Types.ObjectId) {
    return Icp.findOne({ _id: id, startupId }).lean();
  },

  async update(startupId: Types.ObjectId, id: Types.ObjectId, patch: { name?: string; criteria?: Criteria }) {
    const current = await Icp.findOne({ _id: id, startupId });
    if (!current) return null;

    const before = JSON.stringify(current.toObject().criteria);
    const after = patch.criteria === undefined ? undefined : JSON.stringify(patch.criteria);
    if (patch.name !== undefined) current.name = patch.name;
    if (patch.criteria !== undefined && before !== after) {
      current.criteria = patch.criteria as typeof current.criteria;
      current.criteriaVersion += 1;
    }
    await current.save();
    return current.toObject();
  },

  async archive(startupId: Types.ObjectId, id: Types.ObjectId) {
    const current = await Icp.findOne({ _id: id, startupId });
    if (!current) return null;
    if (current.isActive) {
      current.isActive = false;
      await current.save();
    }
    return current;
  },
};
