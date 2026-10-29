import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type {
  ApproverRoleOption,
  FormWorkflowConfigResponse,
  FormWorkflowOption,
  PendingTask,
  ProcessedTask,
  AssistantMonitorItem,
  StaffProcessMode,
  WorkflowAction,
  WorkflowConfig,
  WorkflowStep,
} from '../types/workflows.types';

export const DEFAULT_WORKFLOW_KEY = '__default__';

export const workflowsApi = {
  getDefaultConfig: () =>
    axiosInstance.get<ApiResponse<WorkflowConfig>>(`${API_ENDPOINTS.WORKFLOWS}/config/default`),

  updateDefaultConfig: (steps: WorkflowStep[]) =>
    axiosInstance.put<ApiResponse<WorkflowConfig>>(`${API_ENDPOINTS.WORKFLOWS}/config/default`, {
      steps,
    }),

  getApproverRoles: () =>
    axiosInstance.get<ApiResponse<ApproverRoleOption[]>>(
      `${API_ENDPOINTS.WORKFLOWS}/config/approver-roles`,
    ),

  listFormConfigs: () =>
    axiosInstance.get<ApiResponse<FormWorkflowOption[]>>(
      `${API_ENDPOINTS.WORKFLOWS}/config/forms`,
    ),

  getFormConfig: (formType: string, formId: string) =>
    axiosInstance.get<ApiResponse<FormWorkflowConfigResponse>>(
      `${API_ENDPOINTS.WORKFLOWS}/config/forms/${formType}/${formId}`,
    ),

  updateFormConfig: (formType: string, formId: string, steps: WorkflowStep[]) =>
    axiosInstance.put<ApiResponse<FormWorkflowConfigResponse>>(
      `${API_ENDPOINTS.WORKFLOWS}/config/forms/${formType}/${formId}`,
      { steps },
    ),

  getPending: () =>
    axiosInstance.get<ApiResponse<PendingTask[]>>(`${API_ENDPOINTS.WORKFLOWS}/pending`),

  getProcessed: () =>
    axiosInstance.get<ApiResponse<ProcessedTask[]>>(`${API_ENDPOINTS.WORKFLOWS}/processed`),

  getAssistantMonitor: (filter: string = 'all') =>
    axiosInstance.get<ApiResponse<AssistantMonitorItem[]>>(
      `${API_ENDPOINTS.WORKFLOWS}/assistant-monitor`,
      { params: { filter } },
    ),

  viewSubmissionFile: async (fileUrl: string) => {
    try {
      const response = await axiosInstance.get('/convert-file-and-submit/view-file', {
        params: { url: fileUrl },
        responseType: 'blob',
        timeout: 120000,
      });
      const blob = response.data as Blob;
      const contentType = String(response.headers['content-type'] || blob.type || '');
      if (contentType.includes('application/json')) {
        const text = await blob.text();
        const json = JSON.parse(text) as { message?: string; error?: { message?: string } };
        throw new Error(json.error?.message || json.message || 'Không mở được file hồ sơ');
      }
      return blob;
    } catch (error) {
      const data = (error as { response?: { data?: unknown } })?.response?.data;
      if (data instanceof Blob) {
        const text = await data.text();
        try {
          const json = JSON.parse(text) as { message?: string; error?: { message?: string } };
          throw new Error(json.error?.message || json.message || 'Không mở được file hồ sơ');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            throw new Error('Không mở được file hồ sơ');
          }
          throw parseErr;
        }
      }
      throw error;
    }
  },

  approve: (fileId: string, data?: WorkflowAction) =>
    axiosInstance.post(`${API_ENDPOINTS.WORKFLOWS}/${fileId}/approve`, data, {
      timeout: 150000,
    }),

  /** Duyệt / ký / từ chối hàng loạt (tối đa 50) */
  bulkProcess: (data: {
    submissionIds: string[];
    action: StaffProcessMode | 'reject';
    comment?: string;
    signature?: WorkflowAction['signature'];
  }) =>
    axiosInstance.post<
      ApiResponse<{
        total: number;
        successCount: number;
        failedCount: number;
        success: { submissionId: string }[];
        failed: { submissionId: string; message: string }[];
      }>
    >(`${API_ENDPOINTS.WORKFLOWS}/bulk/process`, data, { timeout: 300000 }),

  reject: (fileId: string, data: WorkflowAction) =>
    axiosInstance.post(`${API_ENDPOINTS.WORKFLOWS}/${fileId}/reject`, data),

  returnToStudent: (fileId: string, data: WorkflowAction) =>
    axiosInstance.post(`${API_ENDPOINTS.WORKFLOWS}/${fileId}/return`, data),
};
