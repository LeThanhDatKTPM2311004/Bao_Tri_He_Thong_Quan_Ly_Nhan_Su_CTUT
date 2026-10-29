import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';

export interface SystemOverview {
  system: {
    status: string;
    version: string;
    nodeEnv: string;
    serverTime: string;
  };
  database: {
    connected: boolean;
    readyState: number;
    host: string;
    label: string;
  };
  portals: {
    adminPortalUrl: string;
    studentPortalUrl: string;
    clientUrls: string[];
  };
  integrations: {
    email: {
      configured: boolean;
      provider: 'brevo' | 'smtp' | 'none' | string;
      from: string;
      label: string;
    };
    google: {
      configured: boolean;
      label: string;
    };
    cloudinary: {
      configured: boolean;
      cloudName: string;
      label: string;
    };
    ca: {
      configured: boolean;
      mode: 'live' | 'mock' | string;
      label: string;
    };
  };
  upload: {
    maxFileSize: number;
    maxFileSizeMb: number;
  };
}

export const settingsApi = {
  getOverview: () =>
    axiosInstance.get<ApiResponse<SystemOverview>>(API_ENDPOINTS.SETTINGS.OVERVIEW),
};
