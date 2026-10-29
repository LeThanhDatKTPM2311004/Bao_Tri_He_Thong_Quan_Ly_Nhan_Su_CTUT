// [ADMIN-PORTAL] Quản lý mẫu Word — chỉ admin/staff portal, không dùng cho student FE
import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse } from '@/shared/types/api.types';
import type { ImportedForm } from '../types/forms.types';

export const wordTemplatesApi = {
  importTemplate: (file: File, tenDon?: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    const name = (tenDon || file.name.replace(/\.docx$/i, '')).trim();
    if (name) formData.append('tenDon', name);
    if (description) formData.append('description', description);
    return axiosInstance.post(API_ENDPOINTS.IMPORT_FORMS, formData);
  },

  list: () => axiosInstance.get<ApiResponse<ImportedForm[]>>(API_ENDPOINTS.IMPORT_FORMS),

  get: (id: string) =>
    axiosInstance.get<ApiResponse<ImportedForm>>(`${API_ENDPOINTS.IMPORT_FORMS}/${id}`),

  downloadTemplate: async (id: string, filename?: string) => {
    const response = await axiosInstance.get(`${API_ENDPOINTS.IMPORT_FORMS}/${id}/download`, {
      responseType: 'blob',
    });
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'mau-bieu-mau.docx';
    a.click();
    URL.revokeObjectURL(url);
  },

  downloadExcelTemplate: async (id: string, filename?: string) => {
    const response = await axiosInstance.get(
      `${API_ENDPOINTS.IMPORT_FORMS}/${id}/excel-template`,
      { responseType: 'blob', timeout: 60000 },
    );
    const blob = response.data as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'mau-import-don.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  },

  importSubmissions: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return axiosInstance.post(`${API_ENDPOINTS.IMPORT_FORMS}/${id}/import-submissions`, formData, {
      timeout: 300000,
    });
  },

  delete: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`${API_ENDPOINTS.IMPORT_FORMS}/${id}`),

  /** [ADMIN-PORTAL] Sửa tên đơn / trạng thái hoạt động */
  update: (id: string, data: { tenDon?: string; description?: string; isActive?: boolean }) =>
    axiosInstance.put<ApiResponse<ImportedForm>>(`${API_ENDPOINTS.IMPORT_FORMS}/${id}`, data),

  /** [ADMIN-PORTAL] Xem trước mẫu đã import */
  previewTemplate: async (url: string): Promise<Blob> => {
    const response = await axiosInstance.post(`${API_ENDPOINTS.IMPORT_FORMS}/preview`, { url }, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};

/** @deprecated use wordTemplatesApi */
export const formsApi = wordTemplatesApi;
