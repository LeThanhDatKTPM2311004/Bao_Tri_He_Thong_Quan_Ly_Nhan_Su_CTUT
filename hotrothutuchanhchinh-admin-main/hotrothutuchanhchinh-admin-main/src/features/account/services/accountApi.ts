import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type { User } from '@/features/auth/types/auth.types';

export interface UpdateProfilePayload {
  fullName: string;
  phone?: string;
  dateOfBirth?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  address?: string;
  avatar?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface LinkGooglePayload {
  idToken: string;
}

export const accountApi = {
  getMe: () => axiosInstance.get<ApiResponse<User>>(API_ENDPOINTS.USERS.ME),
  updateMe: (data: UpdateProfilePayload) =>
    axiosInstance.patch<ApiResponse<User>>(API_ENDPOINTS.USERS.ME, data),
  changePassword: (data: ChangePasswordPayload) =>
    axiosInstance.patch<ApiResponse<null>>(API_ENDPOINTS.USERS.CHANGE_PASSWORD, data),
  linkGoogle: (data: LinkGooglePayload) =>
    axiosInstance.post<ApiResponse<User>>(API_ENDPOINTS.USERS.GOOGLE_LINK, data),
  unlinkGoogle: () =>
    axiosInstance.delete<ApiResponse<User>>(API_ENDPOINTS.USERS.GOOGLE_LINK),
  uploadAvatar: (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return axiosInstance.post<ApiResponse<User>>(`${API_ENDPOINTS.USERS.ME}/avatar`, formData);
  },
  deleteAvatar: () => axiosInstance.delete<ApiResponse<User>>(`${API_ENDPOINTS.USERS.ME}/avatar`),
  uploadSignatureImage: (file: File) => {
    const formData = new FormData();
    formData.append('signature', file);
    return axiosInstance.post<ApiResponse<User>>(
      `${API_ENDPOINTS.USERS.ME}/signature-image`,
      formData,
    );
  },
  deleteSignatureImage: () =>
    axiosInstance.delete<ApiResponse<User>>(`${API_ENDPOINTS.USERS.ME}/signature-image`),
  verifySmartCa: (smartCaUserId: string) =>
    axiosInstance.post<ApiResponse<User>>(`${API_ENDPOINTS.USERS.ME}/smartca/verify`, {
      smartCaUserId,
    }),
  unlinkSmartCa: () =>
    axiosInstance.delete<ApiResponse<User>>(`${API_ENDPOINTS.USERS.ME}/smartca`),
};
