import AuditLog from './auditLog.model.js';
import { buildPaginationMeta } from '../../shared/utils/pagination.js';

export const getAll = async (query, pagination) => {
  const filter = {};
  if (query.userId) filter.userId = query.userId;
  if (query.action) filter.action = query.action;

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('userId', 'fullName email')
      .skip(pagination.skip)
      .limit(pagination.limit)
      .sort({ createdAt: -1 }),
    AuditLog.countDocuments(filter),
  ]);

  return { data, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
};

export const getByEntity = (entityType, entityId) =>
  AuditLog.find({ entityType, entityId }).sort({ createdAt: -1 });

export const create = (data) => AuditLog.create(data);

/** Ghi nhật ký thao tác. Lỗi ghi log không làm hỏng việc duyệt/ký. */
export const writeAuditLog = async (entry) => {
  try {
    if (!entry?.action) return;
    await AuditLog.create({
      userId: entry.userId || null,
      action: entry.action,
      entityType: entry.entityType || '',
      entityId: entry.entityId || null,
      metadata: entry.metadata || {},
      ipAddress: entry.ipAddress || '',
      userAgent: entry.userAgent || '',
    });
  } catch (error) {
    console.error('[Audit]', error?.message || error);
  }
};

export const auditContextFromReq = (req) => ({
  ipAddress: req?.ip || '',
  userAgent: req?.get?.('user-agent') || '',
});
