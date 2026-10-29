import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type { GoogleLoginPayload, LoginCredentials, LoginResponse, User } from '../types/auth.types';

export const authApi = {
  login: (credentials: LoginCredentials) =>
    axiosInstance.post<ApiResponse<LoginResponse>>(
      API_ENDPOINTS.AUTH.LOGIN,
      credentials,
    ),

  googleLogin: (payload: GoogleLoginPayload) =>
    axiosInstance.post<ApiResponse<LoginResponse>>(
      API_ENDPOINTS.AUTH.GOOGLE_LOGIN,
      payload,
    ),

  logout: () => axiosInstance.post(API_ENDPOINTS.AUTH.LOGOUT),

  getMe: () => axiosInstance.get<ApiResponse<User>>(API_ENDPOINTS.AUTH.ME),

  refresh: (refreshToken: string) =>
    axiosInstance.post(API_ENDPOINTS.AUTH.REFRESH, { refreshToken }),

  forgotPassword: (data: { accountEmail: string; recipientEmail: string }) =>
    axiosInstance.post<ApiResponse<{ message: string }>>(API_ENDPOINTS.AUTH.FORGOT_PASSWORD, data),

  verifyResetToken: (token: string) =>
    axiosInstance.get<ApiResponse<{ valid: boolean; accountEmail?: string }>>(
      API_ENDPOINTS.AUTH.VERIFY_RESET_TOKEN,
      {
      params: { token },
    }),

  resetPassword: (data: { token: string; password: string }) =>
    axiosInstance.post<ApiResponse<{ message: string }>>(API_ENDPOINTS.AUTH.RESET_PASSWORD, data),
};
