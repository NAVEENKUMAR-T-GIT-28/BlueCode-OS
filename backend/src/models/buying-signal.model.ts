import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const evidenceSchema = new Schema({
  field: { type: String, required: true, trim: true, maxlength: 80 },
  value: { type: String, required: true, maxlength: 200 },
}, { _id: false, strict: 'throw' });

const buyingSignalSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  decisionMakerId: { type: Schema.Types.ObjectId, ref: 'DecisionMaker' },
  signalType: { type: String, required: true, enum: ['company_growth', 'technology', 'leadership', 'contact_change', 'other'] },
  description: { type: String, required: true, trim: true, minlength: 1, maxlength: 500 },
  evidence: { type: [evidenceSchema], required: true, validate: { validator: (v: unknown) => Array.isArray(v) && v.length >= 1 && v.length <= 10, message: 'evidence must contain 1–10 items' } },
  confidence: { type: Number, required: true, min: 0, max: 1 },
  status: { type: String, required: true, enum: ['active', 'dismissed'], default: 'active' },
  detectedAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

buyingSignalSchema.index({ startupId: 1, prospectId: 1, detectedAt: -1 });
buyingSignalSchema.index({ startupId: 1, status: 1, detectedAt: -1 });

export type BuyingSignalDocument = InferSchemaType<typeof buyingSignalSchema>;
export const BuyingSignal: Model<BuyingSignalDocument> =
  (mongoose.models['BuyingSignal'] as Model<BuyingSignalDocument>) ?? model('BuyingSignal', buyingSignalSchema, 'buyingSignals');
