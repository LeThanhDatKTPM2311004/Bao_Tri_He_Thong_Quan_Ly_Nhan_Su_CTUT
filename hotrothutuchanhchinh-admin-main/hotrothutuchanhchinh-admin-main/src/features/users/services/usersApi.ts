import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type { UserListItem } from '../types/users.types';

export interface CreateUserPayload extends Partial<UserListItem> {
  password?: string;
}

export interface UpdateUserPayload extends Partial<UserListItem> {
  password?: string;
}

export const usersApi = {
  getAll: (params?: Record<string, unknown>) =>
    axiosInstance.get<PaginatedResponse<UserListItem>>(API_ENDPOINTS.USERS.BASE, { params }),

  getById: (id: string) =>
    axiosInstance.get<ApiResponse<UserListItem>>(`${API_ENDPOINTS.USERS.BASE}/${id}`),

  create: (data: CreateUserPayload) =>
    axiosInstance.post<ApiResponse<UserListItem>>(API_ENDPOINTS.USERS.BASE, data),

  update: (id: string, data: UpdateUserPayload) =>
    axiosInstance.put<ApiResponse<UserListItem>>(`${API_ENDPOINTS.USERS.BASE}/${id}`, data),

  toggleStatus: (id: string, isActive: boolean) =>
    axiosInstance.patch<ApiResponse<UserListItem>>(`${API_ENDPOINTS.USERS.BASE}/${id}/status`, { isActive }),

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`${API_ENDPOINTS.USERS.BASE}/${id}`),

  getAdvisorDuty: (id: string) =>
    axiosInstance.get<
      ApiResponse<{
        khoaId: string | null;
        boMonId: string | null;
        khoaName?: string;
        khoaCode?: string;
        boMonName?: string;
        boMonCode?: string;
        maGV: string | null;
        lopCoVanIds: string[];
        lopCoVans?: Array<{ _id: string; code: string; name: string }>;
      }>
    >(`${API_ENDPOINTS.USERS.BASE}/${id}/advisor-duty`),

  assignAdvisorDuty: (
    id: string,
    data: { khoaId: string; boMonId: string; lopCoVanIds: string[]; maGV?: string },
  ) =>
    axiosInstance.put<ApiResponse<UserListItem>>(
      `${API_ENDPOINTS.USERS.BASE}/${id}/advisor-duty`,
      data,
    ),
};
