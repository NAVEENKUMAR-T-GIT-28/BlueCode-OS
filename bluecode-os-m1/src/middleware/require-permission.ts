import type { RequestHandler } from 'express';
import { ApiError } from '../shared/api-error.js';
import { permissionMatrix, type Permission } from '../config/permissions.js';

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.tenant) return next(new ApiError(403, 'NOT_A_MEMBER', 'Active workspace membership is required'));
    if (!(permissionMatrix[permission] as readonly string[]).includes(req.tenant.role)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));
    }
    next();
  };
}
