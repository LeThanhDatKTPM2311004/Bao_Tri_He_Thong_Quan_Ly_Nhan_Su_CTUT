import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type { DashboardStats } from '../types/dashboard.types';

export const dashboardApi = {
  getStats: () =>
    axiosInstance.get<ApiResponse<DashboardStats>>(`${API_ENDPOINTS.DASHBOARD}/stats`),
};
