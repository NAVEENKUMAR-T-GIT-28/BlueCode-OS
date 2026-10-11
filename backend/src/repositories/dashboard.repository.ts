import { Types } from 'mongoose';
import { DecisionMaker } from '../models/decision-maker.model.js';
import { LeadScore } from '../models/lead-score.model.js';
import { NextBestAction } from '../models/next-best-action.model.js';
import { OutreachMessage } from '../models/outreach-message.model.js';
import { Prospect } from '../models/prospect.model.js';
import { SalesActivity } from '../models/sales-activity.model.js';

async function countHotAndHigh(startupId: Types.ObjectId): Promise<number> {
  const rows = await LeadScore.aggregate([
    { $match: { startupId } },
    { $sort: { prospectId: 1, scoredAt: -1, _id: -1 } },
    { $group: { _id: '$prospectId', category: { $first: '$category' } } },
    { $match: { category: { $in: ['hot', 'high'] } } },
    { $count: 'count' },
  ]).exec() as Array<{ count: number }>;
  return rows[0]?.count ?? 0;
}

export const dashboardRepository = {
  async snapshot(input: { startupId: Types.ObjectId; now: Date; dayStart: Date; nextDay: Date }) {
    const { startupId, now, dayStart, nextDay } = input;
    const [
      prospectsFound,
      hotAndHigh,
      draftsPendingApproval,
      readyForHandoff,
      followUpsDue,
      discovered,
      qualified,
      contactProspectIds,
      approvedDrafts,
      handedOff,
      userReportedSent,
      repliesLogged,
    ] = await Promise.all([
      Prospect.countDocuments({ startupId, createdAt: { $gte: dayStart, $lt: nextDay } }),
      countHotAndHigh(startupId),
      OutreachMessage.countDocuments({ startupId, status: 'draft', approvalStatus: 'pending' }),
      OutreachMessage.countDocuments({ startupId, status: 'ready', approvalStatus: 'approved' }),
      NextBestAction.countDocuments({
        startupId, status: 'pending', actionType: 'follow_up', dueAt: { $lte: nextDay },
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
      }),
      Prospect.countDocuments({ startupId }),
      Prospect.countDocuments({ startupId, status: 'qualified' }),
      DecisionMaker.distinct('prospectId', { startupId, businessEmail: { $exists: true, $type: 'string', $ne: '' } }),
      SalesActivity.countDocuments({ startupId, activityType: 'message_approved' }),
      SalesActivity.countDocuments({ startupId, activityType: 'handoff_requested' }),
      SalesActivity.countDocuments({ startupId, activityType: 'message_user_reported_sent' }),
      SalesActivity.countDocuments({ startupId, activityType: 'reply_logged' }),
    ]);

    return {
      today: {
        prospectsFound,
        hotAndHigh,
        draftsPendingApproval,
        readyForHandoff,
        followUpsDue,
      },
      funnel: {
        discovered,
        qualified,
        contactsWithEmail: contactProspectIds.length,
        approvedDrafts,
        handedOff,
        userReportedSent,
        repliesLogged,
      },
    };
  },
};
