import { ForbiddenError } from '../errors/AppError.js';
import { ROLE_PERMISSIONS } from '../../config/roles.js';

export const authorize = (...allowedRoles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required'));
    }

    const { role } = req.user;

    if (allowedRoles.length > 0 && !allowedRoles.includes(role) && role !== 'admin') {
      return next(new ForbiddenError('Insufficient permissions'));
    }

    req.permissions = ROLE_PERMISSIONS[role] || [];
    next();
  };
};

export const requirePermission = (...requiredPermissions) => {
  return (req, _res, next) => {
    const permissions = req.permissions || ROLE_PERMISSIONS[req.user?.role] || [];

    if (req.user?.role === 'admin') return next();

    const hasPermission = requiredPermissions.every((p) => permissions.includes(p));
    if (!hasPermission) {
      return next(new ForbiddenError('Missing required permission'));
    }

    next();
  };
};
