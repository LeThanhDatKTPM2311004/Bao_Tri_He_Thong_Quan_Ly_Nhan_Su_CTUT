import * as notificationService from './notification.service.js';
import * as workflowNotification from './workflowNotification.service.js';
import * as workflowService from '../workflows/workflow.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { ROLES } from '../../config/roles.js';

const syncStaffNotifications = async (user) => {
  if (!user?.role || user.role === ROLES.STUDENT) return;

  // Tránh double khi FE gọi song song getAll + unread-count
  const key = String(user.id || user._id);
  if (syncStaffNotifications._inflight?.has(key)) {
    await syncStaffNotifications._inflight.get(key);
    return;
  }
  if (!syncStaffNotifications._inflight) {
    syncStaffNotifications._inflight = new Map();
  }

  const job = (async () => {
    try {
      if (workflowService.isAssistantOverviewRole?.(user.role) || workflowService.isAssistantRole?.(user.role)) {
        const monitor = await workflowService.getAssistantMonitor(user, 'all');
        await workflowNotification.syncAssistantScopeNotifications(user, monitor);
        return;
      }

      const pending = await workflowService.getPendingTasks(user);
      await workflowNotification.syncPendingNotificationsForUser(user, pending);

      if (workflowService.isLeaderOverviewRole(user.role)) {
        const overview = await workflowService.getScopedOverviewForLeader(user);
        await workflowNotification.syncLeaderScopeNotifications(user, overview);
      }
    } catch (err) {
      console.error('[Notifications] sync staff failed:', err.message);
    }
  })();

  syncStaffNotifications._inflight.set(key, job);
  try {
    await job;
  } finally {
    syncStaffNotifications._inflight.delete(key);
  }
};

export const getAll = async (req, res) => {
  await syncStaffNotifications(req.user);
  const notifications = await notificationService.getByUser(req.user.id, req.query);
  return successResponse(res, notifications);
};

export const getUnreadCount = async (req, res) => {
  await syncStaffNotifications(req.user);
  const count = await notificationService.getUnreadCount(req.user.id);
  return successResponse(res, { count });
};

export const markAsRead = async (req, res) => {
  await notificationService.markAsRead(req.params.id, req.user.id);
  return successResponse(res, null, 'Marked as read');
};

export const markAllAsRead = async (req, res) => {
  await notificationService.markAllAsRead(req.user.id);
  return successResponse(res, null, 'All marked as read');
};
