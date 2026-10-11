import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

export const MESSAGE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revision_requested'] as const;
export const MESSAGE_STATUSES = ['draft', 'ready', 'handed_off', 'user_reported_sent', 'cancelled'] as const;

const outreachMessageSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  campaignId: { type: Schema.Types.ObjectId, required: true, ref: 'OutreachCampaign' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  decisionMakerId: { type: Schema.Types.ObjectId, required: true, ref: 'DecisionMaker' },
  step: { type: Number, required: true, min: 1, max: 5, validate: Number.isSafeInteger, default: 1 },
  revision: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, default: 1 },
  subject: { type: String, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 5000 },
  approvalStatus: { type: String, required: true, enum: [...MESSAGE_APPROVAL_STATUSES], default: 'pending' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  status: { type: String, required: true, enum: [...MESSAGE_STATUSES], default: 'draft' },
  idempotencyKey: { type: String, required: true, trim: true, minlength: 1, maxlength: 300 },
  sentAt: { type: Date },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

outreachMessageSchema.index({ startupId: 1, campaignId: 1, status: 1 });
outreachMessageSchema.index({ startupId: 1, decisionMakerId: 1, createdAt: -1 });
outreachMessageSchema.index({ startupId: 1, approvalStatus: 1 });
outreachMessageSchema.index({ startupId: 1, idempotencyKey: 1 }, { unique: true });

export type OutreachMessageDocument = InferSchemaType<typeof outreachMessageSchema>;
export const OutreachMessage: Model<OutreachMessageDocument> =
  (mongoose.models['OutreachMessage'] as Model<OutreachMessageDocument>) ??
  model('OutreachMessage', outreachMessageSchema, 'outreachMessages');
