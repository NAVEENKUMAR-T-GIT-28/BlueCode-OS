import { Types } from 'mongoose';
import { Prospect } from '../models/prospect.model.js';
import type { OrganizationCandidate } from '../providers/apollo/sales-data-provider.js';

function firmographicsFor(candidate: OrganizationCandidate): Record<string, any> | undefined {
  if (!candidate.firmographics) return undefined;
  const allowed: Record<string, unknown> = {};
  for (const key of [
    'industry', 'employeeCount', 'country', 'region', 'revenueRange',
    'technologies', 'keywords', 'openJobCount', 'latestFundingStage',
  ]) {
    const value = candidate.firmographics[key as keyof typeof candidate.firmographics];
    if (value !== undefined) allowed[key] = value;
  }
  return allowed;
}

export const discoveryRepository = {
  findByApolloOrganizationId(startupId: Types.ObjectId, apolloOrganizationId: string) {
    return Prospect.findOne({ startupId, apolloOrganizationId }).sort({ createdAt: 1 }).lean();
  },

  findByDomain(startupId: Types.ObjectId, domain: string) {
    return Prospect.findOne({ startupId, domain }).sort({ createdAt: 1 }).lean();
  },

  async create(startupId: Types.ObjectId, icpId: Types.ObjectId, candidate: OrganizationCandidate) {
    return Prospect.create({
      startupId,
      icpId,
      apolloOrganizationId: candidate.apolloOrganizationId,
      name: candidate.name,
      ...(candidate.domain ? { domain: candidate.domain } : {}),
      ...(firmographicsFor(candidate) ? { firmographics: firmographicsFor(candidate) } : {}),
      status: 'discovered',
    });
  },

  async refresh(startupId: Types.ObjectId, prospectId: Types.ObjectId, candidate: OrganizationCandidate, bindApolloId: boolean) {
    const set: Record<string, unknown> = { name: candidate.name };
    if (candidate.domain) set.domain = candidate.domain;
    const firmographics = firmographicsFor(candidate);
    if (firmographics) set.firmographics = firmographics;
    if (bindApolloId) set.apolloOrganizationId = candidate.apolloOrganizationId;
    return Prospect.findOneAndUpdate(
      { _id: prospectId, startupId },
      { $set: set },
      { new: true, runValidators: true },
    ).lean();
  },
};
