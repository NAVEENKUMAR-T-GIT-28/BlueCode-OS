import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apolloMode: 'mock' as 'mock' | 'live',
  icp: null as any,
  findById: vi.fn(),
  findByApolloOrganizationId: vi.fn(),
  findByDomain: vi.fn(),
  create: vi.fn(),
  refresh: vi.fn(),
  checkEntitlement: vi.fn(),
  recordMockUsage: vi.fn(),
  getSummary: vi.fn(),
  scoreMany: vi.fn(),
}));

vi.mock('../src/config/env.js', () => ({ env: { get APOLLO_MODE() { return mocks.apolloMode; } } }));
vi.mock('../src/repositories/icp.repository.js', () => ({ icpRepository: { findById: mocks.findById } }));
vi.mock('../src/repositories/discovery.repository.js', () => ({ discoveryRepository: {
  findByApolloOrganizationId: mocks.findByApolloOrganizationId,
  findByDomain: mocks.findByDomain,
  create: mocks.create,
  refresh: mocks.refresh,
} }));
vi.mock('../src/services/scoring.service.js', () => ({ scoringService: { scoreMany: mocks.scoreMany } }));
vi.mock('../src/services/usage.service.js', () => ({ usageService: {
  checkEntitlement: mocks.checkEntitlement,
  recordMockUsage: mocks.recordMockUsage,
  getSummary: mocks.getSummary,
} }));

import { Types } from 'mongoose';
import { discoveryService } from '../src/services/discovery.service.js';

const startupId = '507f1f77bcf86cd799439011';
const icpId = '507f1f77bcf86cd799439012';
const otherIcpId = '507f1f77bcf86cd799439013';
const prospectId = '507f1f77bcf86cd799439014';
const baseIcp = { _id: new Types.ObjectId(icpId), isActive: true, criteria: {
  industries: ['Human Resources Software'], countries: ['United Kingdom'],
} };

beforeEach(() => {
  mocks.apolloMode = 'mock';
  mocks.icp = baseIcp;
  mocks.findById.mockReset().mockImplementation(async () => mocks.icp);
  mocks.findByApolloOrganizationId.mockReset().mockResolvedValue(null);
  mocks.findByDomain.mockReset().mockResolvedValue(null);
  mocks.create.mockReset().mockImplementation(async (_startupId: unknown, originIcpId: unknown, candidate: any) => ({
    _id: new Types.ObjectId(prospectId), startupId: new Types.ObjectId(startupId), icpId: originIcpId,
    name: candidate.name, domain: candidate.domain, apolloOrganizationId: candidate.apolloOrganizationId,
    status: 'discovered', createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    firmographics: candidate.firmographics,
  }));
  mocks.refresh.mockReset().mockImplementation(async (_startupId: unknown, _prospectId: unknown, candidate: any) => ({
    _id: new Types.ObjectId(prospectId), startupId: new Types.ObjectId(startupId), icpId: new Types.ObjectId(otherIcpId),
    name: candidate.name, domain: candidate.domain, apolloOrganizationId: candidate.apolloOrganizationId,
    status: 'discovered', createdAt: new Date('2026-01-01T00:00:00.000Z'), updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    firmographics: candidate.firmographics,
  }));
  mocks.checkEntitlement.mockReset().mockResolvedValue({ allowed: true, used: 0, limit: null });
  mocks.recordMockUsage.mockReset().mockResolvedValue(undefined);
  mocks.getSummary.mockReset().mockResolvedValue({ spend: { remainingPaise: 9000 } });
  mocks.scoreMany.mockReset().mockImplementation(async (_startupId: string, input: { prospectIds: string[]; icpId: string }) => ({
    scored: input.prospectIds.length,
    items: input.prospectIds.map(id => ({
      prospectId: id, icpId: input.icpId, score: 81, category: 'high', coverage: 0.8,
      scoredAt: new Date('2026-01-01T00:00:00.000Z'),
    })),
  }));
});

describe('discoveryService.search', () => {
  const input = { startupId, plan: 'trial' as const, icpId, page: 1, perPage: 25 };

  it('creates synthetic matches, scores deterministically, and records a zero-cost mock call', async () => {
    const result = await discoveryService.search(input);
    expect(result.created).toBe(1);
    expect(result.existing).toBe(0);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: 'Mock Workforce Cloud 001', domain: 'mock-workforce-001.example',
      latestScore: { icpId, score: 81, category: 'high' },
    });
    expect(mocks.recordMockUsage).toHaveBeenCalledWith(expect.objectContaining({
      startupId, entityRef: { kind: 'icp', id: icpId },
    }), 'apollo.org_search');
    expect(mocks.scoreMany).toHaveBeenCalledWith(startupId, { prospectIds: [prospectId], icpId });
    expect(result.spend.remainingPaise).toBe(9000);
  });

  it('keeps the immutable origin ICP and counts a cross-ICP company separately', async () => {
    const existingDoc = {
      _id: new Types.ObjectId(prospectId), icpId: new Types.ObjectId(otherIcpId),
      apolloOrganizationId: 'mock-org-hr-001', domain: 'mock-workforce-001.example',
    };
    mocks.findByApolloOrganizationId.mockResolvedValue(existingDoc);
    const result = await discoveryService.search(input);
    expect(result.created).toBe(0);
    expect(result.existing).toBe(0);
    expect(result.alsoMatchesIcp).toBe(1);
    expect(mocks.refresh).toHaveBeenCalledWith(expect.any(Types.ObjectId), expect.any(Types.ObjectId), expect.any(Object), false);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns 404 for an ICP outside the tenant (or missing)', async () => {
    mocks.findById.mockResolvedValue(null);
    await expect(discoveryService.search(input)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects archived ICPs before calling the provider or writing prospects', async () => {
    mocks.icp = { ...baseIcp, isActive: false };
    mocks.findById.mockResolvedValue(mocks.icp);
    await expect(discoveryService.search(input)).rejects.toMatchObject({ status: 409, code: 'INVALID_STATE' });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('fails closed in live mode until the capability is verified', async () => {
    mocks.apolloMode = 'live';
    await expect(discoveryService.search(input)).rejects.toMatchObject({
      status: 503, code: 'CAPABILITY_DISABLED', details: { capability: 'search_orgs' },
    });
    expect(mocks.findById).toHaveBeenCalledTimes(1);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.recordMockUsage).not.toHaveBeenCalled();
  });
});
