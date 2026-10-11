import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';
import { normalizeDomain } from '../utils/normalize-domain.js';

const stringArray = (limit: number) => ({
  type: [String], default: undefined,
  validate: { validator: (v: unknown) => v === undefined || (Array.isArray(v) && v.length <= limit && v.every(x => typeof x === 'string' && x.trim().length > 0 && x.trim().length <= 80)), message: `Array must contain at most ${limit} non-empty strings of at most 80 characters` },
});

const firmographicsSchema = new Schema({
  industry: { type: String, trim: true, maxlength: 120 },
  employeeCount: { type: Number, min: 0, validate: Number.isSafeInteger },
  country: { type: String, trim: true, maxlength: 80 },
  region: { type: String, trim: true, maxlength: 120 },
  revenueRange: { type: String, trim: true, maxlength: 80 },
  technologies: stringArray(50),
  keywords: stringArray(50),
  openJobCount: { type: Number, min: 0, validate: Number.isSafeInteger },
  latestFundingAt: { type: Date },
  latestFundingStage: { type: String, trim: true, maxlength: 80 },
}, { _id: false, strict: 'throw' });

const prospectSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  icpId: { type: Schema.Types.ObjectId, required: true, ref: 'Icp', immutable: true },
  apolloOrganizationId: { type: String, trim: true, maxlength: 160 },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
  domain: { type: String, trim: true, maxlength: 253, set: normalizeDomain },
  status: { type: String, required: true, enum: ['discovered', 'qualified', 'disqualified', 'do_not_contact'], default: 'discovered' },
  firmographics: { type: firmographicsSchema, default: undefined },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

prospectSchema.index({ startupId: 1, apolloOrganizationId: 1 }, {
  unique: true, partialFilterExpression: { apolloOrganizationId: { $type: 'string', $gt: '' } },
});
prospectSchema.index({ startupId: 1, icpId: 1, status: 1 });
prospectSchema.index({ startupId: 1, domain: 1 });
prospectSchema.index({ startupId: 1, status: 1, updatedAt: -1 });

export type ProspectDocument = InferSchemaType<typeof prospectSchema>;
export const Prospect: Model<ProspectDocument> =
  (mongoose.models['Prospect'] as Model<ProspectDocument>) ?? model('Prospect', prospectSchema, 'prospects');
