import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const leadScoreSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  icpId: { type: Schema.Types.ObjectId, required: true, ref: 'Icp' },
  score: { type: Number, required: true, min: 0, max: 100, validate: Number.isSafeInteger },
  category: { type: String, required: true, enum: ['hot', 'high', 'medium', 'low'] },
  coverage: { type: Number, required: true, min: 0, max: 1 },
  breakdown: { type: Schema.Types.Mixed, required: true, validate: { validator: (v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    const entries = Object.entries(v as Record<string, unknown>);
    return entries.length <= 12 && entries.every(([key, n]) => key.length > 0 && typeof n === 'number' && Number.isFinite(n));
  }, message: 'breakdown must be an object of at most 12 numeric components' } },
  explanation: { type: String, maxlength: 2000 },
  explanationSource: { type: String, required: true, enum: ['rules', 'ai'] },
  scoringVersion: { type: String, required: true, maxlength: 80 },
  icpVersion: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  scoredAt: { type: Date, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, autoIndex: false, strict: 'throw' });

leadScoreSchema.index({ startupId: 1, prospectId: 1, scoredAt: -1 });
leadScoreSchema.index({ startupId: 1, icpId: 1, score: -1 });
leadScoreSchema.index({ startupId: 1, prospectId: 1, icpId: 1, scoredAt: -1 });

export type LeadScoreDocument = InferSchemaType<typeof leadScoreSchema>;
export const LeadScore: Model<LeadScoreDocument> =
  (mongoose.models['LeadScore'] as Model<LeadScoreDocument>) ?? model('LeadScore', leadScoreSchema, 'leadScores');
