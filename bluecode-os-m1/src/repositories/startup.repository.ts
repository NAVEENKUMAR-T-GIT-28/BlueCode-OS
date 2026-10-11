import type { ClientSession, Types } from 'mongoose';
import { Startup } from '../models/startup.model.js';
import { StartupMember } from '../models/startup-member.model.js';

export const startupRepository = {
  listForUser(userId: Types.ObjectId) {
    return StartupMember.find({ userId, status: 'active' }).select('startupId role status');
  },
  findActiveMembership(userId: Types.ObjectId, startupId: Types.ObjectId) {
    return StartupMember.findOne({ userId, startupId, status: 'active' });
  },
  findAccessibleStartup(startupId: Types.ObjectId) {
    return Startup.findOne({ _id: startupId, status: { $in: ['active', 'trial_expired'] } });
  },
  async createWithOwner(input: { ownerUserId: Types.ObjectId; name: string; trialSpendCapPaise: number }, session: ClientSession) {
    const trialEndsAt = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
    const [startup] = await Startup.create([{
      ownerUserId: input.ownerUserId, name: input.name, plan: 'trial', status: 'active',
      trialEndsAt, apiSpendCap: input.trialSpendCapPaise, spendCommitted: 0, spendReserved: 0,
    }], { session });
    if (!startup) throw new Error('Workspace creation failed');
    await StartupMember.create([{
      startupId: startup._id, userId: input.ownerUserId, role: 'owner', status: 'active',
    }], { session });
    return startup;
  },
};
