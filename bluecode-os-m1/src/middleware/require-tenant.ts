import { Types } from 'mongoose';
import type { RequestHandler } from 'express';
import { startupService } from '../services/startup.service.js';
import { ApiError } from '../shared/api-error.js';

export const requireTenant: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) throw new ApiError(401, 'UNAUTHENTICATED', 'Authentication is required');
    const startupId = req.header('x-startup-id');
    if (!startupId || !Types.ObjectId.isValid(startupId)) {
      throw new ApiError(403, 'NOT_A_MEMBER', 'An active workspace is required');
    }
    const { membership } = await startupService.resolveCurrent(req.auth.userId.toString(), startupId);
    req.tenant = { startupId: new Types.ObjectId(startupId), role: membership.role };
    next();
  } catch (error) { next(error); }
};
