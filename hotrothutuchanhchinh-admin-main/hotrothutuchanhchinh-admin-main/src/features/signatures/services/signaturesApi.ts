import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';

export interface SignatureProvider {
  value: string;
  label: string;
  mode: 'remote' | 'local' | string;
  configured?: boolean;
  defaultUserId?: string;
}

export interface SignPayload {
  provider: string;
  pin?: string;
  smartCaUsername?: string;
  comment?: string;
  stampImageUrl?: string;
}

export const signaturesApi = {
  getProviders: () =>
    axiosInstance.get<ApiResponse<SignatureProvider[]>>(`${API_ENDPOINTS.SIGNATURES}/providers`),

  sign: (submissionId: string, data: SignPayload) =>
    axiosInstance.post(`${API_ENDPOINTS.SIGNATURES}/${submissionId}/sign`, data, {
      timeout: 150000,
    }),

  verify: (signatureId: string) =>
    axiosInstance.post(`${API_ENDPOINTS.SIGNATURES}/${signatureId}/verify`),

  listBySubmission: (submissionId: string) =>
    axiosInstance.get(`${API_ENDPOINTS.SIGNATURES}/${submissionId}/list`),
};
