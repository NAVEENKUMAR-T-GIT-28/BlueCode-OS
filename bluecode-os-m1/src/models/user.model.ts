import mongoose, { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254, index: true },
  passwordHash: { type: String, required: true, select: false },
  status: { type: String, required: true, enum: ['active', 'pending_verification', 'disabled'], default: 'active' },
}, { timestamps: true, versionKey: false, autoIndex: false });

export type UserDocument = InferSchemaType<typeof userSchema>;
export const User = mongoose.models.User ?? model('User', userSchema, 'users');
