import * as auditLogService from '../auditLogs/auditLog.service.js';

export const auditMiddleware = (action, entityType) => async (req, _res, next) => {
  try {
    await auditLogService.create({
      userId: req.user?.id,
      action,
      entityType,
      entityId: req.params.id || req.body?.id,
      metadata: { method: req.method, path: req.originalUrl },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  } catch (err) {
    console.error('[Audit]', err.message);
  }
  next();
};
