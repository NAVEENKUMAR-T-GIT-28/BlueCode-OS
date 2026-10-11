import { Types } from 'mongoose';
import type { RequestHandler } from 'express';
import { startupService } from '../services/startup.service.js';
import { ApiError } from '../shared/api-error.js';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
    const startupId = req.header('x-startup-id');
    if (!startupId || !Types.ObjectId.isValid(startupId)) {
      throw new ApiError(403, 'NOT_A_MEMBER', 'An active workspace is required');
    }
    const { startup, membership } = await startupService.resolveCurrent(req.auth.userId.toString(), startupId);
    if (startup.status === 'suspended') {
      throw new ApiError(403, 'FORBIDDEN', 'Workspace access is suspended');
    }
    if (startup.status === 'trial_expired' && !READ_METHODS.has(req.method)) {
      throw new ApiError(402, 'TRIAL_EXPIRED', 'The trial has ended; this workspace is read-only');
    }
    req.tenant = {
      startupId: new Types.ObjectId(startupId), role: membership.role,
      plan: startup.plan, status: startup.status,
    };
    next();
  } catch (error) { next(error); }
};
