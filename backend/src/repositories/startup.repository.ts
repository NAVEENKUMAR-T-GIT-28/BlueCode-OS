import type { ClientSession, Types } from 'mongoose';
import { Startup } from '../models/startup.model.js';
import { StartupMember } from '../models/startup-member.model.js';
import { User } from '../models/user.model.js';
import type { StartupSettingsPatch, StartupRole } from '../types/startup.js';

export const startupRepository = {
  listForUser(userId: Types.ObjectId) {
    return StartupMember.find({ userId, status: 'active' }).select('startupId role status').lean();
  },

  findActiveMembership(userId: Types.ObjectId, startupId: Types.ObjectId) {
    return StartupMember.findOne({ userId, startupId, status: 'active' });
  },

  findAccessibleStartup(startupId: Types.ObjectId) {
    return Startup.findOne({ _id: startupId, status: { $in: ['active', 'trial_expired'] } });
  },

  updateSettings(startupId: Types.ObjectId, patch: { name?: string; settings?: StartupSettingsPatch }) {
    const $set: Record<string, string> = {};
    if (patch.name !== undefined) $set.name = patch.name;
    if (patch.settings) {
      for (const key of ['calendarLink', 'senderName', 'senderTitle', 'productSummary'] as const) {
        const value = patch.settings[key];
        if (value !== undefined) $set[`settings.${key}`] = value;
      }
    }
    return Startup.findOneAndUpdate(
      { _id: startupId, status: 'active' },
      { $set },
      { new: true, runValidators: true },
    );
  },

  async listMembers(startupId: Types.ObjectId) {
    const memberships = await StartupMember.find({ startupId }).sort({ createdAt: 1 }).lean();
    if (memberships.length === 0) return [];
    const users = await User.find({ _id: { $in: memberships.map(item => item.userId) } })
      .select('name email status').lean();
    const userById = new Map(users.map(user => [String(user._id), user]));
    return memberships.map(member => {
      const user = userById.get(String(member.userId));
      return {
        id: String(member._id),
        userId: String(member.userId),
        name: user?.name ?? '',
        email: user?.email ?? '',
        role: member.role,
        status: member.status,
      };
    });
  },

  findMemberById(startupId: Types.ObjectId, memberId: Types.ObjectId) {
    return StartupMember.findOne({ _id: memberId, startupId });
  },

  findMembershipForUser(startupId: Types.ObjectId, userId: Types.ObjectId) {
    return StartupMember.findOne({ startupId, userId });
  },

  findInviteCandidate(email: string) {
    return User.findOne({ email: email.toLowerCase(), status: 'active' }).select('_id name email status');
  },

  findInviteCandidateById(userId: Types.ObjectId) {
    return User.findById(userId).select('_id name email status');
  },

  countOccupiedSeats(startupId: Types.ObjectId) {
    return StartupMember.countDocuments({ startupId, status: { $in: ['active', 'invited'] } });
  },

  async createOrReactivateInvitation(input: {
    startupId: Types.ObjectId;
    userId: Types.ObjectId;
    role: Exclude<StartupRole, 'owner'>;
  }) {
    const existing = await StartupMember.findOne({ startupId: input.startupId, userId: input.userId });
    if (existing) {
      if (existing.status !== 'removed') return { kind: 'exists' as const };
      existing.role = input.role;
      existing.status = 'invited';
      await existing.save();
      return { kind: 'created' as const, member: existing };
    }
    try {
      const [member] = await StartupMember.create([{
        startupId: input.startupId,
        userId: input.userId,
        role: input.role,
        status: 'invited',
      }]);
      return member ? { kind: 'created' as const, member } : { kind: 'exists' as const };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        return { kind: 'exists' as const };
      }
      throw error;
    }
  },

  async updateMemberRole(startupId: Types.ObjectId, memberId: Types.ObjectId, role: StartupRole) {
    const member = await StartupMember.findOne({ _id: memberId, startupId });
    if (!member) return { kind: 'not_found' as const };
    if (member.status === 'removed') return { kind: 'invalid_state' as const };
    if (member.role === 'owner' && role !== 'owner' && member.status === 'active') {
      const activeOwners = await StartupMember.countDocuments({ startupId, role: 'owner', status: 'active' });
      if (activeOwners <= 1) return { kind: 'last_owner' as const };
    }
    member.role = role;
    await member.save();
    return { kind: 'updated' as const, member };
  },

  async removeMember(startupId: Types.ObjectId, memberId: Types.ObjectId) {
    const member = await StartupMember.findOne({ _id: memberId, startupId });
    if (!member) return { kind: 'not_found' as const };
    if (member.status === 'removed') return { kind: 'removed' as const };
    if (member.role === 'owner' && member.status === 'active') {
      const activeOwners = await StartupMember.countDocuments({ startupId, role: 'owner', status: 'active' });
      if (activeOwners <= 1) return { kind: 'last_owner' as const };
    }
    member.status = 'removed';
    await member.save();
    return { kind: 'removed' as const };
  },

  async createWithOwner(
    input: { ownerUserId: Types.ObjectId; name: string; trialSpendCapPaise: number },
    session?: ClientSession,
  ) {
    const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const opts = session ? { session } : {};
    const [startup] = await Startup.create([{
      ownerUserId: input.ownerUserId, name: input.name, plan: 'trial', status: 'active',
      trialEndsAt, apiSpendCap: input.trialSpendCapPaise, spendCommitted: 0, spendReserved: 0,
    }], opts);
    if (!startup) throw new Error('Workspace creation failed');
    await StartupMember.create([{
      startupId: startup._id, userId: input.ownerUserId, role: 'owner', status: 'active',
    }], opts);
    return startup;
  },
};

export type MembershipRow = {
  startupId: Types.ObjectId;
  role: string;
  status: string;
};
