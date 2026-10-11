import mongoose, { Types } from 'mongoose';
import { env } from '../config/env.js';
import { permissionsForRole } from '../config/permissions.js';
import { getMaxUsersForPlan } from '../config/plan-limits.js';
import { ApiError } from '../shared/api-error.js';
import { startupRepository, type MembershipRow } from '../repositories/startup.repository.js';
import type { StartupRole, StartupSettingsPatch } from '../types/startup.js';

export const startupService = {
  async create(userId: string, name: string) {
    try {
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
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code !== 20) throw err;
      // Development-only fallback for standalone MongoDB.
      const result = await startupRepository.createWithOwner({
        ownerUserId: new Types.ObjectId(userId),
        name: name.trim(),
        trialSpendCapPaise: env.TRIAL_SPEND_CAP_PAISE,
      });
      return {
        id: result.id, name: result.name, plan: result.plan, status: result.status,
        trialEndsAt: result.trialEndsAt, createdAt: result.createdAt,
      };
    }
  },

  async list(userId: string) {
    const memberships = await startupRepository.listForUser(new Types.ObjectId(userId));
    const rows = await Promise.all(memberships.map(async (membership: MembershipRow) => {
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

  async updateSettings(startupId: string, patch: { name?: string; settings?: StartupSettingsPatch }) {
    const startup = await startupRepository.updateSettings(new Types.ObjectId(startupId), patch);
    if (!startup) throw new ApiError(404, 'NOT_FOUND', 'Workspace not found');
    return startup;
  },

  async listMembers(startupId: string) {
    return startupRepository.listMembers(new Types.ObjectId(startupId));
  },

  async inviteMember(input: {
    startupId: string;
    plan: 'trial' | 'starter' | 'growth' | 'pro';
    email: string;
    role: 'admin' | 'member';
  }) {
    const startupId = new Types.ObjectId(input.startupId);
    const user = await startupRepository.findInviteCandidate(input.email.trim().toLowerCase());
    if (!user) throw new ApiError(422, 'VALIDATION_FAILED', 'No active account exists for this email');

    const current = await startupRepository.findMembershipForUser(startupId, user._id);
    if (current && current.status !== 'removed') {
      throw new ApiError(409, 'CONFLICT', 'This user already has a membership or invitation');
    }

    const maxUsers = getMaxUsersForPlan(input.plan);
    if (maxUsers === undefined) {
      throw new ApiError(503, 'CAPABILITY_DISABLED', 'The maxUsers entitlement is not configured for this plan');
    }
    const occupied = await startupRepository.countOccupiedSeats(startupId);
    if (occupied >= maxUsers) {
      throw new ApiError(402, 'PLAN_LIMIT_REACHED', 'Workspace user limit reached', {
        metric: 'maxUsers', used: occupied, limit: maxUsers,
      });
    }

    const result = await startupRepository.createOrReactivateInvitation({
      startupId, userId: user._id, role: input.role,
    });
    if (result.kind === 'exists') throw new ApiError(409, 'CONFLICT', 'This user already has a membership or invitation');
    return this.memberDto(result.member, user);
  },

  async updateMemberRole(startupId: string, memberId: string, role: StartupRole) {
    if (!Types.ObjectId.isValid(memberId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed member ID');
    const result = await startupRepository.updateMemberRole(new Types.ObjectId(startupId), new Types.ObjectId(memberId), role);
    if (result.kind === 'not_found') throw new ApiError(404, 'NOT_FOUND', 'Member not found');
    if (result.kind === 'invalid_state') throw new ApiError(409, 'INVALID_STATE', 'A removed membership cannot change role');
    if (result.kind === 'last_owner') throw new ApiError(409, 'INVALID_STATE', 'The last active owner cannot be demoted');
    const user = await startupRepository.findInviteCandidateById(result.member.userId);
    return this.memberDto(result.member, user);
  },

  async removeMember(startupId: string, memberId: string) {
    if (!Types.ObjectId.isValid(memberId)) throw new ApiError(400, 'MALFORMED_REQUEST', 'Malformed member ID');
    const result = await startupRepository.removeMember(new Types.ObjectId(startupId), new Types.ObjectId(memberId));
    if (result.kind === 'not_found') throw new ApiError(404, 'NOT_FOUND', 'Member not found');
    if (result.kind === 'last_owner') throw new ApiError(409, 'INVALID_STATE', 'The last active owner cannot be removed');
  },

  memberDto(member: { _id: Types.ObjectId; userId: Types.ObjectId; role: string; status: string }, user: { _id: Types.ObjectId; name: string; email: string } | null) {
    return {
      id: String(member._id), userId: String(member.userId),
      name: user?.name ?? '', email: user?.email ?? '',
      role: member.role, status: member.status,
    };
  },
};
