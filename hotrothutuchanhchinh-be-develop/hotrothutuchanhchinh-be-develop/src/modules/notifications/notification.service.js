import Notification from './notification.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { sendEmailNotification } from './channels/emailChannel.js';

/** Giữ bản mới nhất theo (entityId, type); xóa bản trùng */
export const dedupeEntityNotificationsForUser = async (userId) => {
  const rows = await Notification.find({
    recipientId: userId,
    entityId: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .select('_id entityId type createdAt')
    .lean();

  const seen = new Set();
  const toDelete = [];
  for (const row of rows) {
    const key = `${String(row.entityId)}:${row.type}`;
    if (seen.has(key)) {
      toDelete.push(row._id);
    } else {
      seen.add(key);
    }
  }
  if (toDelete.length) {
    await Notification.deleteMany({ _id: { $in: toDelete } });
  }
  return toDelete.length;
};

const enrichWithSubmissionFiles = async (notifications = []) => {
  const ids = [
    ...new Set(
      notifications
        .filter((n) => (n.entityType === 'GeneratedFile' || !n.entityType) && n.entityId)
        .map((n) => String(n.entityId)),
    ),
  ];
  if (!ids.length) {
    return notifications.map((n) => {
      const obj = typeof n.toObject === 'function' ? n.toObject() : { ...n };
      return { ...obj, fileUrl: null, formName: null, canViewFile: false };
    });
  }

  const files = await GeneratedFile.find({ _id: { $in: ids } })
    .select('_id duongDanFile tenDon trangThai')
    .lean();
  const map = new Map(files.map((f) => [String(f._id), f]));

  return notifications.map((n) => {
    const obj = typeof n.toObject === 'function' ? n.toObject() : { ...n };
    const file = n.entityId ? map.get(String(n.entityId)) : null;
    return {
      ...obj,
      fileUrl: file?.duongDanFile || null,
      formName: file?.tenDon || null,
      canViewFile: Boolean(file?.duongDanFile),
    };
  });
};

export const getByUser = async (userId, query = {}) => {
  await dedupeEntityNotificationsForUser(userId);
  const filter = { recipientId: userId };
  if (query.isRead !== undefined) filter.isRead = query.isRead === 'true';
  const limit = Math.min(Number(query.limit) || 80, 100);
  const rows = await Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
  return enrichWithSubmissionFiles(rows);
};

export const getUnreadCount = async (userId) => {
  await dedupeEntityNotificationsForUser(userId);
  return Notification.countDocuments({ recipientId: userId, isRead: false });
};

export const markAsRead = (id, userId) =>
  Notification.findOneAndUpdate(
    { _id: id, recipientId: userId },
    { isRead: true, readAt: new Date() },
  );

export const markAllAsRead = (userId) =>
  Notification.updateMany(
    { recipientId: userId, isRead: false },
    { isRead: true, readAt: new Date() },
  );

export const create = async (data) => {
  const notification = await Notification.create(data);
  if (data.channels?.includes('email')) {
    await sendEmailNotification(notification);
  }
  return notification;
};

export const findUnreadByEntity = (recipientId, entityId, type) =>
  Notification.findOne({
    recipientId,
    entityId,
    type,
    isRead: false,
  }).select('_id');

/** Bản ghi gần nhất theo entity + type (đã đọc hoặc chưa) — dùng sync overview */
export const findLatestByEntity = (recipientId, entityId, type) =>
  Notification.findOne({
    recipientId,
    entityId,
    type,
  }).sort({ createdAt: -1 });

/**
 * Upsert 1 thông báo / (user + entity + type) — tránh double khi sync song song
 * hoặc notify nhiều đường (bước hiện tại + lãnh đạo).
 */
export const upsertEntityNotification = async ({
  recipientId,
  type,
  title,
  message,
  entityId,
  entityType = 'GeneratedFile',
  markUnreadOnChange = false,
}) => {
  if (!recipientId || !entityId || !type) {
    return create({
      recipientId,
      type,
      title,
      message,
      entityType,
      entityId,
      channels: ['in_app'],
    });
  }

  try {
    const existing = await Notification.findOne({ recipientId, entityId, type }).sort({
      createdAt: -1,
    });

    if (existing) {
      const changed = existing.title !== title || existing.message !== message;
      if (!changed) {
        await Notification.deleteMany({
          recipientId,
          entityId,
          type,
          _id: { $ne: existing._id },
        });
        return existing;
      }
      existing.title = title;
      existing.message = message;
      if (markUnreadOnChange || type === 'deadline_warning') {
        existing.isRead = false;
        existing.readAt = undefined;
      }
      await existing.save();
      await Notification.deleteMany({
        recipientId,
        entityId,
        type,
        _id: { $ne: existing._id },
      });
      return existing;
    }

    return await create({
      recipientId,
      type,
      title,
      message,
      entityType,
      entityId,
      channels: ['in_app'],
    });
  } catch (err) {
    // Race: bản ghi vừa được tạo bởi request song song
    if (err?.code === 11000) {
      const latest = await findLatestByEntity(recipientId, entityId, type);
      if (latest) {
        await Notification.deleteMany({
          recipientId,
          entityId,
          type,
          _id: { $ne: latest._id },
        });
      }
      return latest;
    }
    throw err;
  }
};
