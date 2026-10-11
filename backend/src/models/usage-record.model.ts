import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const entityRefSchema = new Schema({
  kind: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  id: { type: String, required: true, trim: true, minlength: 1, maxlength: 160 },
}, { _id: false, strict: 'throw' });

const usageRecordSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  provider: { type: String, required: true, enum: ['apollo', 'llm'] },
  operation: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  status: { type: String, required: true, enum: ['success', 'failed', 'blocked'] },
  creditsConsumed: { type: Number, min: 0, validate: Number.isFinite },
  costAmount: { type: Number, min: 0, validate: Number.isSafeInteger },
  costType: { type: String, required: true, enum: ['estimated', 'reported'] },
  errorCode: { type: String, trim: true, maxlength: 100 },
  requestId: { type: String, trim: true, maxlength: 160 },
  entityRef: { type: entityRefSchema },
  occurredAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, autoIndex: false, strict: 'throw' });

usageRecordSchema.index({ startupId: 1, occurredAt: -1 });
usageRecordSchema.index({ startupId: 1, provider: 1, operation: 1, occurredAt: -1 });

export type UsageRecordDocument = InferSchemaType<typeof usageRecordSchema>;
export const UsageRecord: Model<UsageRecordDocument> =
  (mongoose.models['UsageRecord'] as Model<UsageRecordDocument>) ?? model('UsageRecord', usageRecordSchema, 'usageRecords');
