import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../shared/api-error.js';
import { userRepository } from '../repositories/user.repository.js';

const emailSchema = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const authService = {
  async register(input: { name: string; email: string; password: string }) {
    const email = input.email.trim().toLowerCase();
    if (!emailSchema.test(email)) throw new ApiError(422, 'VALIDATION_FAILED', 'A valid email is required');
    if (input.password.length < 10 || input.password.length > 128) {
      throw new ApiError(422, 'VALIDATION_FAILED', 'Password must be 10–128 characters');
    }
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
    try {
      const user = await userRepository.create({ name: input.name.trim(), email, passwordHash: await argon2.hash(input.password) });
      return { id: user.id, name: user.name, email: user.email, status: user.status };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 11000) {
        throw new ApiError(409, 'CONFLICT', 'An account with this email already exists');
      }
      throw error;
    }
  },
  async login(input: { email: string; password: string }) {
    const user = await userRepository.findByEmail(input.email.trim().toLowerCase());
    const valid = user?.status === 'active' && user.passwordHash
      ? await argon2.verify(user.passwordHash, input.password).catch(() => false)
      : false;
    if (!valid || !user) throw new ApiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect');
    const token = jwt.sign({ sub: user.id }, env.JWT_ACTIVE_SECRET, { algorithm: 'HS256', expiresIn: env.JWT_TTL_SECONDS, keyid: '0' });
    return { token, user: { id: user.id, name: user.name, email: user.email } };
  },
  verify(token: string): string {
    for (const secret of env.JWT_SECRETS) {
      try {
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
        if (typeof payload === 'object' && typeof payload.sub === 'string') return payload.sub;
      } catch { /* try the next configured rotation key */ }
    }
    throw new ApiError(401, 'UNAUTHENTICATED', 'Session is invalid or expired');
  },
};
