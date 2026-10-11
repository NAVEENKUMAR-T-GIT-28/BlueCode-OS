import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { icpRepository } from '../repositories/icp.repository.js';
import { discoveryRepository } from '../repositories/discovery.repository.js';
import { scoringService } from './scoring.service.js';
import { usageService } from './usage.service.js';
import { apolloMock } from '../providers/apollo/apollo-mock.js';
import { ApiError } from '../shared/api-error.js';
import { normalizeDomain } from '../utils/normalize-domain.js';
import type { OrganizationCandidate } from '../providers/apollo/sales-data-provider.js';
import type { StartupPlan } from '../types/startup.js';

function valueId(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function plainCriteria(value: unknown): Record<string, string[] | undefined> {
  if (value && typeof value === 'object' && 'toObject' in value &&
      typeof (value as { toObject?: unknown }).toObject === 'function') {
    return (value as { toObject: () => Record<string, string[] | undefined> }).toObject();
  }
  return (value ?? {}) as Record<string, string[] | undefined>;
}

function prospectRow(doc: any, latestScore: any) {
  return {
    id: valueId(doc._id),
    icpId: valueId(doc.icpId),
    name: doc.name,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(doc.apolloOrganizationId ? { apolloOrganizationId: doc.apolloOrganizationId } : {}),
    ...(doc.domain ? { domain: doc.domain } : {}),
    ...(doc.firmographics ? { firmographics: doc.firmographics } : {}),
    ...(latestScore ? { latestScore: {
      icpId: valueId(latestScore.icpId), score: latestScore.score,
      category: latestScore.category, coverage: latestScore.coverage,
      scoredAt: latestScore.scoredAt,
    } } : {}),
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 11000;
}

async function findExisting(startupId: Types.ObjectId, candidate: OrganizationCandidate) {
  // External provider identity takes precedence; normalized domain is the fallback.
  const byApolloId = await discoveryRepository.findByApolloOrganizationId(startupId, candidate.apolloOrganizationId);
  if (byApolloId) return { document: byApolloId, matchedByApolloId: true };
  const domain = normalizeDomain(candidate.domain);
  if (domain) {
    const byDomain = await discoveryRepository.findByDomain(startupId, domain);
    if (byDomain) return { document: byDomain, matchedByApolloId: false };
  }
  return null;
}

function deduplicatePage(items: OrganizationCandidate[]): OrganizationCandidate[] {
  const seenIds = new Set<string>();
  const seenDomains = new Set<string>();
  const unique: OrganizationCandidate[] = [];
  for (const item of items) {
    const apolloId = item.apolloOrganizationId.trim();
    const domain = normalizeDomain(item.domain);
    if (!apolloId || seenIds.has(apolloId) || (domain && seenDomains.has(domain))) continue;
    seenIds.add(apolloId);
    if (domain) seenDomains.add(domain);
    unique.push({ ...item, ...(domain ? { domain } : {}) });
  }
  return unique;
}

export const discoveryService = {
  async search(input: {
    startupId: string;
    plan: StartupPlan;
    icpId: string;
    page: number;
    perPage: number;
    requestId?: string;
  }) {
    if (!Types.ObjectId.isValid(input.startupId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed workspace ID');
    if (!Types.ObjectId.isValid(input.icpId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed ICP ID');
    const startupId = new Types.ObjectId(input.startupId);
    const icpId = new Types.ObjectId(input.icpId);
    const requestedIcpId = icpId.toString();
    const icp = await icpRepository.findById(startupId, icpId);
    if (!icp) throw new ApiError(404, 'NOT_FOUND', 'ICP not found');
    if (!icp.isActive) throw new ApiError(409, 'INVALID_STATE', 'Archived ICPs cannot be used for discovery');
    if (env.APOLLO_MODE !== 'mock') {
      // Live Apollo remains deliberately unavailable until capability and commercial gates are cleared.
      throw new ApiError(503, 'CAPABILITY_DISABLED', 'Organization search is disabled until Apollo search_orgs is verified and enabled', {
        capability: 'search_orgs',
      });
    }

    await usageService.checkEntitlement(input.startupId, input.plan, 'prospects');
    const providerResult = await apolloMock.searchOrganizations({
      criteria: plainCriteria(icp.criteria), page: input.page, perPage: input.perPage,
    });
    const candidates = deduplicatePage(providerResult.items);

    // This is an auditable zero-cost mock call, not an Apollo call or a commercial-use assertion.
    await usageService.recordMockUsage({
      startupId: input.startupId,
      ...(input.requestId ? { requestId: input.requestId } : {}),
      entityRef: { kind: 'icp', id: input.icpId },
    }, 'apollo.org_search');

    let created = 0;
    let existing = 0;
    let alsoMatchesIcp = 0;
    const scoreIds = new Set<string>();
    const visible: any[] = [];

    for (const candidate of candidates) {
      let found = await findExisting(startupId, candidate);
      if (found) {
        const originIcpId = valueId(found.document.icpId);
        const refreshed = await discoveryRepository.refresh(
          startupId,
          new Types.ObjectId(valueId(found.document._id)),
          candidate,
          !found.matchedByApolloId && !found.document.apolloOrganizationId,
        );
        const document = refreshed ?? found.document;
        scoreIds.add(valueId(document._id));
        if (originIcpId === requestedIcpId) {
          existing++;
        } else {
          // Never rewrite prospects.icpId: it is the immutable origin ICP.
          alsoMatchesIcp++;
          visible.push(document);
        }
        continue;
      }

      try {
        const document = await discoveryRepository.create(startupId, icpId, candidate);
        created++;
        scoreIds.add(valueId(document._id));
        visible.push(document);
      } catch (error) {
        // A concurrent search may have created the same Apollo organization first.
        if (!isDuplicateKey(error)) throw error;
        found = await findExisting(startupId, candidate);
        if (!found) throw error;
        const originIcpId = valueId(found.document.icpId);
        const refreshed = await discoveryRepository.refresh(
          startupId,
          new Types.ObjectId(valueId(found.document._id)),
          candidate,
          !found.matchedByApolloId && !found.document.apolloOrganizationId,
        );
        const document = refreshed ?? found.document;
        scoreIds.add(valueId(document._id));
        if (originIcpId === requestedIcpId) existing++;
        else { alsoMatchesIcp++; visible.push(document); }
      }
    }

    const scoring = scoreIds.size
      ? await scoringService.scoreMany(input.startupId, { prospectIds: [...scoreIds], icpId: input.icpId })
      : { items: [] as any[] };
    const scoreByProspect = new Map(scoring.items.map((score: any) => [valueId(score.prospectId), score]));
    const items = visible.map(document => prospectRow(document, scoreByProspect.get(valueId(document._id))));
    const summary = await usageService.getSummary(input.startupId);

    return {
      created,
      existing,
      alsoMatchesIcp,
      hasMore: providerResult.hasMore,
      items,
      spend: { remainingPaise: summary.spend.remainingPaise },
    };
  },
};
