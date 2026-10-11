import type { RequestHandler } from 'express';
import { authService } from '../services/auth.service.js';
import { sessionCookieOptions } from '../middleware/authenticate.js';
import { ApiError } from '../shared/api-error.js';
import { userRepository } from '../repositories/user.repository.js';
import { startupService } from '../services/startup.service.js';

export const register: RequestHandler = async (req, res, next) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ data: user });
  } catch (error) { next(error); }
};

export const login: RequestHandler = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    const memberships = await startupService.list(result.user.id);
    res.cookie('bc_session', result.token, sessionCookieOptions);
    res.json({ data: { user: result.user, memberships } });
  } catch (error) { next(error); }
};

export const me: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
    const user = await userRepository.findActiveById(req.auth.userId.toString());
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Session is invalid or expired');
    const memberships = await startupService.list(user.id);
    res.json({ data: {
      user: { id: user.id, name: user.name, email: user.email, status: user.status, createdAt: user.createdAt },
      memberships,
    } });
  } catch (error) { next(error); }
};

export const logout: RequestHandler = (_req, res) => {
  const { httpOnly, secure, sameSite, path } = sessionCookieOptions;
  res.clearCookie('bc_session', { httpOnly, secure, sameSite, path });
  res.status(204).end();
};
