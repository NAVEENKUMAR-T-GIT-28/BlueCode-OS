import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { authService } from '../services/auth.service.js';
import { userRepository } from '../repositories/user.repository.js';
import { ApiError } from '../shared/api-error.js';

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const token = req.cookies?.bc_session;
    if (!token) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
    const userId = authService.verify(token);
    const user = await userRepository.findActiveById(userId);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Session is invalid or expired');
    req.auth = { userId: user._id };
    next();
  } catch (error) { next(error); }
};

export const sessionCookieOptions = {
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: env.JWT_TTL_SECONDS * 1000,
};
