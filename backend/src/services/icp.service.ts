import { Types } from 'mongoose';
import { icpRepository } from '../repositories/icp.repository.js';
import { ApiError } from '../shared/api-error.js';

type Criteria = Record<string, string[] | undefined>;

function criteriaToDto(criteria: unknown): unknown {
  if (criteria && typeof criteria === 'object' && 'toObject' in criteria &&
      typeof (criteria as { toObject?: unknown }).toObject === 'function') {
    return (criteria as { toObject: () => unknown }).toObject();
  }
  return criteria;
}

function toDto(doc: any) {
  return {
    id: String(doc._id),
    name: doc.name,
    criteria: criteriaToDto(doc.criteria),
    criteriaVersion: doc.criteriaVersion,
    isActive: doc.isActive,
    createdBy: String(doc.createdBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export const icpService = {
  async create(input: { startupId: string; userId: string; plan: 'trial' | 'starter' | 'growth' | 'pro'; name: string; criteria: Criteria }) {
    if (input.plan === 'trial') {
      const activeCount = await icpRepository.countActive(new Types.ObjectId(input.startupId));
      if (activeCount >= 1) {
        throw new ApiError(402, 'PLAN_LIMIT_REACHED', 'The trial plan allows one active ICP', { metric: 'icps', used: activeCount, limit: 1 });
      }
    }
    const doc = await icpRepository.create({
      startupId: new Types.ObjectId(input.startupId),
      name: input.name,
      criteria: input.criteria,
      createdBy: new Types.ObjectId(input.userId),
    });
    return toDto(doc);
  },

  async list(input: {
    startupId: string; isActive?: boolean; sort: 'createdAt' | '-createdAt'; page: number; limit: number;
  }) {
    const [items, total] = await icpRepository.list(new Types.ObjectId(input.startupId), input);
    return { items: items.map(toDto), meta: { page: input.page, limit: input.limit, total } };
  },

  async get(startupId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
    const doc = await icpRepository.findById(new Types.ObjectId(startupId), new Types.ObjectId(id));
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    return toDto(doc);
  },

  async update(startupId: string, id: string, patch: { name?: string; criteria?: Criteria }) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
    const doc = await icpRepository.update(new Types.ObjectId(startupId), new Types.ObjectId(id), patch);
    if (!doc) throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    return toDto(doc);
  },

  async archive(startupId: string, id: string) {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
    if (!await icpRepository.archive(new Types.ObjectId(startupId), new Types.ObjectId(id))) {
      throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    }
  },
};
