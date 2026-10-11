import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findIcp: vi.fn(),
  findProspect: vi.fn(),
  findProspects: vi.fn(),
  listContactTitles: vi.fn(),
  listRecentActiveSignals: vi.fn(),
  insertScore: vi.fn(),
  findLatest: vi.fn(),
  listHistory: vi.fn(),
}));

vi.mock('../src/repositories/scoring.repository.js', () => ({
  scoringRepository: {
    findIcp: mocks.findIcp,
    findProspect: mocks.findProspect,
    findProspects: mocks.findProspects,
    listContactTitles: mocks.listContactTitles,
    listRecentActiveSignals: mocks.listRecentActiveSignals,
    insertScore: mocks.insertScore,
    findLatest: mocks.findLatest,
    listHistory: mocks.listHistory,
  },
}));

import { Types } from 'mongoose';
import { scoringService } from '../src/services/scoring.service.js';

const startupId = '507f1f77bcf86cd799439011';
const originIcpId = '507f1f77bcf86cd799439012';
const otherIcpId = '507f1f77bcf86cd799439013';
const prospectId = '507f1f77bcf86cd799439014';
const scoreId = '507f1f77bcf86cd799439015';
const scoredAt = new Date('2026-10-01T12:00:00.000Z');

function objectId(value: string) {
  return new Types.ObjectId(value);
}

function scoreRow(input: Record<string, any> = {}) {
  return {
    _id: objectId(scoreId),
    startupId: objectId(startupId),
    prospectId: objectId(prospectId),
    icpId: objectId(originIcpId),
    score: 80,
    category: 'high',
    coverage: 1,
    breakdown: { industry: 25 },
    explanation: 'Deterministic test explanation',
    explanationSource: 'rules',
    scoringVersion: 'deterministic-v1',
    icpVersion: 1,
    scoredAt,
    createdAt: scoredAt,
    ...input,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findIcp.mockResolvedValue({
    _id: objectId(originIcpId),
    isActive: true,
    criteria: { industries: ['Software'] },
    criteriaVersion: 1,
  });
  mocks.findProspect.mockResolvedValue({ _id: objectId(prospectId), icpId: objectId(originIcpId) });
  mocks.findProspects.mockResolvedValue([{
    _id: objectId(prospectId),
    icpId: objectId(originIcpId),
    name: 'Synthetic fixture',
    firmographics: { industry: 'Software' },
  }]);
  mocks.listContactTitles.mockResolvedValue([]);
  mocks.listRecentActiveSignals.mockResolvedValue([]);
  mocks.insertScore.mockImplementation(async (input: Record<string, any>) => scoreRow(input));
  mocks.findLatest.mockResolvedValue(scoreRow());
  mocks.listHistory.mockResolvedValue({ items: [], total: 0 });
});

describe('scoringService tenant and ICP scoping', () => {
  it('scores a tenant-owned prospect against the explicitly requested ICP', async () => {
    const result = await scoringService.scoreMany(startupId, {
      prospectIds: [prospectId],
      icpId: originIcpId,
    });

    expect(result.scored).toBe(1);
    expect(mocks.findIcp).toHaveBeenCalledWith(objectId(startupId), objectId(originIcpId));
    expect(mocks.findProspects).toHaveBeenCalledWith(objectId(startupId), [objectId(prospectId)]);
    expect(mocks.insertScore).toHaveBeenCalledWith(expect.objectContaining({
      startupId: objectId(startupId),
      prospectId: objectId(prospectId),
      icpId: objectId(originIcpId),
      scoringVersion: 'deterministic-v1',
      icpVersion: 1,
    }));
  });

  it('rejects a missing or foreign-tenant prospect before inserting any score', async () => {
    mocks.findProspects.mockResolvedValue([]);

    await expect(scoringService.scoreMany(startupId, {
      prospectIds: [prospectId],
      icpId: originIcpId,
    })).rejects.toMatchObject({ status: 422, code: 'VALIDATION_FAILED' });

    expect(mocks.insertScore).not.toHaveBeenCalled();
  });

  it('uses the prospect origin ICP when no ICP filter is supplied', async () => {
    mocks.findProspect.mockResolvedValue({ _id: objectId(prospectId), icpId: objectId(originIcpId) });

    const result = await scoringService.getScores(startupId, prospectId, {
      history: false, page: 1, limit: 20,
    });

    expect(result.history).toBe(false);
    expect(mocks.findProspect).toHaveBeenCalledWith(objectId(startupId), objectId(prospectId));
    const call = mocks.findLatest.mock.calls[0] as unknown as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
    expect(String(call[0])).toBe(startupId);
    expect(String(call[1])).toBe(prospectId);
    expect(String(call[2])).toBe(originIcpId);
  });

  it('selects the requested same-tenant ICP score when icpId is supplied', async () => {
    mocks.findIcp.mockResolvedValue({
      _id: objectId(otherIcpId), isActive: true,
      criteria: { industries: ['Finance'] }, criteriaVersion: 3,
    });
    mocks.findLatest.mockResolvedValue(scoreRow({ icpId: objectId(otherIcpId), icpVersion: 3 }));

    const result = await scoringService.getScores(startupId, prospectId, {
      icpId: otherIcpId, history: false, page: 1, limit: 20,
    });

    expect(result.history).toBe(false);
    expect(mocks.findIcp).toHaveBeenCalledWith(objectId(startupId), objectId(otherIcpId));
    const call = mocks.findLatest.mock.calls[0] as unknown as [Types.ObjectId, Types.ObjectId, Types.ObjectId];
    expect(String(call[2])).toBe(otherIcpId);
  });

  it('returns not found for an ICP not owned by this tenant', async () => {
    mocks.findIcp.mockResolvedValue(null);

    await expect(scoringService.getScores(startupId, prospectId, {
      icpId: otherIcpId, history: false, page: 1, limit: 20,
    })).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    expect(mocks.findLatest).not.toHaveBeenCalled();
  });
});
