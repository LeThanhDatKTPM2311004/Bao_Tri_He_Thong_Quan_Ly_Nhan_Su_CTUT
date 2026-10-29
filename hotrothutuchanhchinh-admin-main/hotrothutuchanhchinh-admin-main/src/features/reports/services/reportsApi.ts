import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type {
  AssistantReportsData,
  ReportQueryParams,
  ReportsData,
} from '../types/reports.types';

export const reportsApi = {
  getWorkflowPerformance: (params?: ReportQueryParams) =>
    axiosInstance.get<ApiResponse<ReportsData>>(
      `${API_ENDPOINTS.REPORTS}/workflow-performance`,
      { params },
    ),

  exportReport: (params?: ReportQueryParams) =>
    axiosInstance.get(`${API_ENDPOINTS.REPORTS}/export`, {
      params,
      responseType: 'blob',
      skipGlobalLoading: false,
    }),

  getAssistantUnitReport: (params?: ReportQueryParams) =>
    axiosInstance.get<ApiResponse<AssistantReportsData>>(
      `${API_ENDPOINTS.REPORTS}/assistant-unit`,
      { params },
    ),

  exportAssistantUnitReport: (params?: ReportQueryParams) =>
    axiosInstance.get(`${API_ENDPOINTS.REPORTS}/assistant-unit/export`, {
      params,
      responseType: 'blob',
      skipGlobalLoading: false,
    }),
};
