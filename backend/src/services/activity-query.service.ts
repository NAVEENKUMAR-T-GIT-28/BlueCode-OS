import { Types } from 'mongoose';
import { salesActivityRepository } from '../repositories/sales-activity.repository.js';
import { ApiError } from '../shared/api-error.js';

function objectId(value: string, label: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) throw new ApiError(400, 'MALFORMED_REQUEST', `Malformed ${label}`);
  return new Types.ObjectId(value);
}

export const activityQueryService = {
  hasReplyAfter(startupIdValue: string, prospectIdValue: string, after: Date) {
    return salesActivityRepository.hasReplyAfter(
      objectId(startupIdValue, 'workspace ID'), objectId(prospectIdValue, 'prospect ID'), after,
    );
  },
  findLatestOutboundActivity(startupIdValue: string, messageIdValue: string) {
    return salesActivityRepository.findLatestOutboundActivity(
      objectId(startupIdValue, 'workspace ID'), objectId(messageIdValue, 'message ID'),
    );
  },
};
