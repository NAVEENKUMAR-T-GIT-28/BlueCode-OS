import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

export const CAMPAIGN_STATUSES = [
  'draft', 'pending_approval', 'approved', 'active', 'paused', 'completed', 'cancelled',
] as const;

const outreachCampaignSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  icpId: { type: Schema.Types.ObjectId, required: true, ref: 'Icp' },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  channel: { type: String, required: true, enum: ['email'], default: 'email' },
  status: { type: String, required: true, enum: [...CAMPAIGN_STATUSES], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

outreachCampaignSchema.index({ startupId: 1, status: 1 });
outreachCampaignSchema.index({ startupId: 1, createdAt: -1 });

export type OutreachCampaignDocument = InferSchemaType<typeof outreachCampaignSchema>;
export const OutreachCampaign: Model<OutreachCampaignDocument> =
  (mongoose.models['OutreachCampaign'] as Model<OutreachCampaignDocument>) ??
  model('OutreachCampaign', outreachCampaignSchema, 'outreachCampaigns');
