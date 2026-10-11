import mongoose, { Schema, model, type Model, type InferSchemaType } from 'mongoose';

const decisionMakerSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, required: true, ref: 'Startup' },
  prospectId: { type: Schema.Types.ObjectId, required: true, ref: 'Prospect' },
  apolloPersonId: { type: String, trim: true, maxlength: 160 },
  fullName: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  jobTitle: { type: String, trim: true, maxlength: 120 },
  businessEmail: { type: String, trim: true, lowercase: true, maxlength: 254, validate: { validator: (v?: string) => v === undefined || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: 'businessEmail must be a valid email address' } },
  linkedinUrl: { type: String, trim: true, maxlength: 300, validate: { validator: (v?: string) => v === undefined || /^https?:\/\//i.test(v), message: 'linkedinUrl must use HTTP or HTTPS' } },
  emailVerified: { type: Boolean },
  source: { type: String, required: true, enum: ['apollo', 'manual'], default: 'apollo' },
  outreachStatus: { type: String, required: true, enum: ['not_contacted', 'drafted', 'approved', 'do_not_contact'], default: 'not_contacted' },
}, { timestamps: true, versionKey: false, autoIndex: false, strict: 'throw' });

decisionMakerSchema.index({ startupId: 1, apolloPersonId: 1 }, {
  unique: true, partialFilterExpression: { apolloPersonId: { $type: 'string', $gt: '' } },
});
decisionMakerSchema.index({ startupId: 1, prospectId: 1 });
decisionMakerSchema.index({ startupId: 1, businessEmail: 1 });
decisionMakerSchema.index({ startupId: 1, prospectId: 1, businessEmail: 1 }, {
  unique: true, partialFilterExpression: { businessEmail: { $type: 'string', $gt: '' } },
});

export type DecisionMakerDocument = InferSchemaType<typeof decisionMakerSchema>;
export const DecisionMaker: Model<DecisionMakerDocument> =
  (mongoose.models['DecisionMaker'] as Model<DecisionMakerDocument>) ?? model('DecisionMaker', decisionMakerSchema, 'decisionMakers');
