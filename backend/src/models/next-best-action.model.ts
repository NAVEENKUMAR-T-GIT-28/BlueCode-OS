import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

export const NEXT_ACTION_TYPES = [
  'follow_up', 'send_reply', 'share_information', 'book_meeting', 'nurture', 'stop_outreach', 'review_prospect',
] as const;
export const NEXT_ACTION_PRIORITIES = ['low', 'medium', 'high'] as const;
export const NEXT_ACTION_STATUSES = ['pending', 'accepted', 'dismissed', 'completed'] as const;

const nextBestActionSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  decisionMakerId: { type: Schema.Types.ObjectId, ref: 'DecisionMaker' },
  actionType: { type: String, required: true, enum: [...NEXT_ACTION_TYPES] },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  reason: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  priority: { type: String, required: true, enum: [...NEXT_ACTION_PRIORITIES] },
  status: { type: String, required: true, enum: [...NEXT_ACTION_STATUSES], default: 'pending' },
  dueAt: { type: Date },
  expiresAt: { type: Date },
  basedOnActivityIds: { type: [{ type: Schema.Types.ObjectId, ref: 'SalesActivity' }], default: undefined },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

nextBestActionSchema.index({ startupId:  1, status: 1, priority: -1 });
nextBestActionSchema.index({ startupId: 1, prospectId: 1, createdAt: -1 });
// Implements the frozen rule: at most one pending action per tenant/prospect/action type.
nextBestActionSchema.index(
  { startupId: 1, prospectId: 1, actionType: 1 },
  { unique: true, partialFilterExpression: { status: 'pending' } },
);

export type NextBestActionDocument = InferSchemaType<typeof nextBestActionSchema>;
export const NextBestAction: Model<NextBestActionDocument> =
  (mongoose.models['NextBestAction'] as Model<NextBestActionDocument>) ??
  model('NextBestAction', nextBestActionSchema, 'nextBestActions');
