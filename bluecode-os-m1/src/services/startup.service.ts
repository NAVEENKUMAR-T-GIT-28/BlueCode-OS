import mongoose, { Types } from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../shared/api-error.js';
import { startupRepository } from '../repositories/startup.repository.js';
import { permissionsForRole } from '../config/permissions.js';

export const startupService = {
  async create(userId: string, name: string) {
    const session = await mongoose.startSession();
    try {
      let result: Awaited<ReturnType<typeof startupRepository.createWithOwner>> | undefined;
      await session.withTransaction(async () => {
        result = await startupRepository.createWithOwner({
          ownerUserId: new Types.ObjectId(userId),
          name: name.trim(),
          trialSpendCapPaise: env.TRIAL_SPEND_CAP_PAISE,
        }, session);
      });
      if (!result) throw new Error('Workspace transaction returned no result');
      return {
        id: result.id, name: result.name, plan: result.plan, status: result.status,
        trialEndsAt: result.trialEndsAt, createdAt: result.createdAt,
      };
    } finally {
      await session.endSession();
    }
  },
  async list(userId: string) {
    const memberships = await startupRepository.listForUser(new Types.ObjectId(userId));
    const rows = await Promise.all(memberships.map(async membership => {
      const startup = await startupRepository.findAccessibleStartup(membership.startupId);
      if (!startup) return null;
      return {
        startupId: startup.id, startupName: startup.name, role: membership.role,
        status: membership.status, plan: startup.plan, startupStatus: startup.status,
      };
    }));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null);
  },
  async resolveCurrent(userId: string, startupId: string) {
    if (!Types.ObjectId.isValid(startupId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed startup ID');
    const objectStartupId = new Types.ObjectId(startupId);
    const membership = await startupRepository.findActiveMembership(new Types.ObjectId(userId), objectStartupId);
    const startup = await startupRepository.findAccessibleStartup(objectStartupId);
    if (!membership || !startup) throw new ApiError(403, 'NOT_A_MEMBER', 'Active workspace membership is required');
    if (startup.status === 'suspended') throw new ApiError(403, 'FORBIDDEN', 'Workspace access is suspended');
    if (startup.plan === 'trial' && startup.trialEndsAt && Date.now() > startup.trialEndsAt.getTime() && startup.status === 'active') {
      startup.status = 'trial_expired';
      await startup.save();
    }
    return { startup, membership, permissions: permissionsForRole(membership.role as 'owner' | 'admin' | 'member') };
  },
};
