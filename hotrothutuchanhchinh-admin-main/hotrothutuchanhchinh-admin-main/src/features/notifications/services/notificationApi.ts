import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type { Notification } from '../types/notifications.types';

export const notificationApi = {
  getAll: (params?: Record<string, unknown>) =>
    axiosInstance.get<ApiResponse<Notification[]>>(API_ENDPOINTS.NOTIFICATIONS, {
      params,
      skipGlobalLoading: true,
    }),

  getUnreadCount: () =>
    axiosInstance.get<ApiResponse<{ count: number }>>(
      `${API_ENDPOINTS.NOTIFICATIONS}/unread-count`,
      { skipGlobalLoading: true },
    ),

  markAsRead: (id: string) =>
    axiosInstance.patch(`${API_ENDPOINTS.NOTIFICATIONS}/${id}/read`),

  markAllAsRead: () =>
    axiosInstance.patch(`${API_ENDPOINTS.NOTIFICATIONS}/read-all`),
};
