import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const activityMetadataKeys: Record<string, string[]> = {
  prospect_discovered: ['source', 'apolloOrganizationId'], contact_added: ['source', 'decisionMakerId'],
  contact_enriched: ['source', 'decisionMakerId'], score_updated: ['icpId', 'score', 'category'],
  signal_detected: ['signalId', 'signalType'], message_approved: ['messageId', 'source'],
  handoff_requested: ['messageId', 'source'], message_user_reported_sent: ['messageId', 'source'],
  reply_logged: ['messageId', 'source'], reply_classified: ['messageId', 'intent', 'confidence'],
  status_changed: ['fromStatus', 'toStatus', 'reason', 'source'],
  integration_error: ['provider', 'operation', 'errorCode'],
};

const salesActivitySchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  campaignId: { type: Schema.Types.ObjectId, ref: 'OutreachCampaign' },
  messageId: { type: Schema.Types.ObjectId, ref: 'OutreachMessage' },
  activityType: { type: String, required: true, enum: ['prospect_discovered', 'contact_added', 'contact_enriched', 'score_updated', 'signal_detected', 'message_approved', 'handoff_requested', 'message_user_reported_sent', 'reply_logged', 'reply_classified', 'status_changed', 'integration_error'] },
  summary: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  classification: {
    intent: { type: String, enum: ['interested', 'buying_interest', 'not_now', 'wrong_person', 'referral', 'objection', 'unsubscribe', 'out_of_office', 'other'] },
    confidence: { type: Number, min: 0, max: 1 },
  },
  metadata: { type: Schema.Types.Mixed, validate: { validator: function (this: any, value: unknown) {
    if (value === undefined) return true;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const record = value as Record<string, unknown>;
    if (Buffer.byteLength(JSON.stringify(record), 'utf8') > 2048) return false;
    const allowed = activityMetadataKeys[this.activityType ?? ''] ?? [];
    return Object.keys(record).every(key => allowed.includes(key) && !key.startsWith('$') && !key.includes('.'));
  }, message: 'metadata contains unsupported keys or exceeds 2 KB' } },
  occurredAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, autoIndex: false, strict: 'throw' });

salesActivitySchema.index({ startupId: 1, occurredAt: -1 });
salesActivitySchema.index({ startupId: 1, prospectId: 1, occurredAt: -1 });

export type SalesActivityDocument = InferSchemaType<typeof salesActivitySchema>;
export const SalesActivity: Model<SalesActivityDocument> =
  (mongoose.models['SalesActivity'] as Model<SalesActivityDocument>) ?? model('SalesActivity', salesActivitySchema, 'salesActivities');
