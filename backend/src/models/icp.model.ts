import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const criteriaArray = {
  type: [String],
  default: undefined,
  validate: {
    validator(value: unknown) {
      return value === undefined || (
        Array.isArray(value) && value.length <= 25 &&
        value.every(item => typeof item === 'string' && item.trim().length > 0 && item.trim().length <= 80)
      );
    },
    message: 'Each criteria array must contain at most 25 non-empty strings of at most 80 characters.',
  },
};

const criteriaSchema = new Schema({
  industries: criteriaArray,
  countries: criteriaArray,
  regions: criteriaArray,
  employeeRanges: criteriaArray,
  revenueRanges: criteriaArray,
  technologies: criteriaArray,
  companyKeywords: criteriaArray,
  excludedIndustries: criteriaArray,
  excludedCompanies: criteriaArray,
  targetJobTitles: criteriaArray,
  targetSeniority: criteriaArray,
  contactLocations: criteriaArray,
}, { _id: false, strict: 'throw' });

const icpSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  criteria: { type: criteriaSchema, required: true },
  criteriaVersion: { type: Number, required: true, default: 1, min: 1, validate: Number.isSafeInteger },
  isActive: { type: Boolean, required: true, default: true },
  createdBy: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

icpSchema.index({ startupId: 1, isActive: 1 });
icpSchema.index({ startupId: 1, createdAt: -1 });

export type IcpDocument = InferSchemaType<typeof icpSchema>;
export const Icp: Model<IcpDocument> =
  (mongoose.models['Icp'] as Model<IcpDocument>) ?? model('Icp', icpSchema, 'icps');
