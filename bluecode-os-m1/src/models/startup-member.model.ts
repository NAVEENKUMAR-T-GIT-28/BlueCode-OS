import mongoose, { Schema, model } from 'mongoose';

const startupMemberSchema = new Schema({
  startupId: { type: Schema.Types.ObjectId, ref: 'Startup', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  role: { type: String, required: true, enum: ['owner', 'admin', 'member'] },
  status: { type: String, required: true, enum: ['invited', 'active', 'removed'], default: 'active' },
}, { timestamps: true, versionKey: false, autoIndex: false });

startupMemberSchema.index({ startupId: 1, userId: 1 }, { unique: true });
startupMemberSchema.index({ userId: 1, status: 1 });
export const StartupMember = mongoose.models.StartupMember ?? model('StartupMember', startupMemberSchema, 'startupMembers');
