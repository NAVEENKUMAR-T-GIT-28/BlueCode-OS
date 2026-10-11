import mongoose, { Schema, model } from 'mongoose';

const startupSchema = new Schema({
  ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  plan: { type: String, required: true, enum: ['trial', 'starter', 'growth', 'pro'], default: 'trial' },
  status: { type: String, required: true, enum: ['active', 'trial_expired', 'suspended'], default: 'active' },
  trialEndsAt: { type: Date },
  apiSpendCap: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  spendCommitted: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  spendReserved: { type: Number, required: true, min: 0, default: 0, validate: Number.isSafeInteger },
  settings: {
    calendarLink: { type: String, maxlength: 200 },
    senderName: { type: String, maxlength: 200 },
    senderTitle: { type: String, maxlength: 200 },
    productSummary: { type: String, maxlength: 1000 },
  },
}, { timestamps: true, versionKey: false, autoIndex: false });

startupSchema.index({ ownerUserId: 1 });
export const Startup = mongoose.models.Startup ?? model('Startup', startupSchema, 'startups');
