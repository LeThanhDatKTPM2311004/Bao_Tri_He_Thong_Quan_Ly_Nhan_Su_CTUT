import { axiosInstance } from '@/services/api/axiosInstance';
import { API_ENDPOINTS } from '@/shared/constants/apiEndpoints';
import type { ApiResponse, PaginatedResponse } from '@/shared/types/api.types';
import type {
  BoMon,
  GiangVien,
  GiangVienQuyen,
  ImportResult,
  Khoa,
  Lop,
  Quyen,
  SinhVien,
} from '../types/organization.types';

const org = API_ENDPOINTS.ORGANIZATION;

const crud = <T>(base: string) => ({
  list: (params?: Record<string, unknown>) =>
    axiosInstance.get<PaginatedResponse<T>>(`${org}/${base}`, { params }),
  create: (data: Partial<T>) =>
    axiosInstance.post<ApiResponse<T>>(`${org}/${base}`, data),
  update: (id: string, data: Partial<T>) =>
    axiosInstance.put<ApiResponse<T>>(`${org}/${base}/${id}`, data),
  remove: (id: string) =>
    axiosInstance.delete<ApiResponse<T>>(`${org}/${base}/${id}`),
  import: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return axiosInstance.post<ApiResponse<ImportResult>>(`${org}/${base}/import`, form);
  },
});

export const organizationApi = {
  khoas: {
    ...crud<Khoa>('khoas'),
    all: () => axiosInstance.get<ApiResponse<Khoa[]>>(`${org}/khoas/all`),
  },
  boMons: {
    ...crud<BoMon>('bo-mons'),
    import: (file: File, context?: { khoaId?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (context?.khoaId) form.append('khoaId', context.khoaId);
      return axiosInstance.post<ApiResponse<ImportResult>>(`${org}/bo-mons/import`, form);
    },
  },
  lops: {
    ...crud<Lop>('lops'),
    import: (file: File, context?: { khoaId?: string; boMonId?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (context?.khoaId) form.append('khoaId', context.khoaId);
      if (context?.boMonId) form.append('boMonId', context.boMonId);
      return axiosInstance.post<ApiResponse<ImportResult>>(`${org}/lops/import`, form);
    },
  },
  sinhViens: {
    ...crud<SinhVien>('sinh-viens'),
    import: (file: File, context?: { lopId?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (context?.lopId) form.append('lopId', context.lopId);
      return axiosInstance.post<ApiResponse<ImportResult>>(`${org}/sinh-viens/import`, form);
    },
  },
  giangViens: {
    ...crud<GiangVien>('giang-viens'),
    import: (file: File, context?: { khoaId?: string; boMonId?: string }) => {
      const form = new FormData();
      form.append('file', file);
      if (context?.khoaId) form.append('khoaId', context.khoaId);
      if (context?.boMonId) form.append('boMonId', context.boMonId);
      return axiosInstance.post<ApiResponse<ImportResult>>(`${org}/giang-viens/import`, form);
    },
  },
  quyens: {
    ...crud<Quyen>('quyens'),
    all: () => axiosInstance.get<ApiResponse<Quyen[]>>(`${org}/quyens/all`),
  },
  giangVienQuyens: {
    list: (params?: Record<string, unknown>) =>
      axiosInstance.get<PaginatedResponse<GiangVienQuyen>>(`${org}/giang-vien-quyens`, { params }),
    assign: (data: { giangVienId: string; quyenId: string; khoaId?: string; boMonId?: string }) =>
      axiosInstance.post<ApiResponse<GiangVienQuyen>>(`${org}/giang-vien-quyens`, data),
    revoke: (id: string) =>
      axiosInstance.delete<ApiResponse<GiangVienQuyen>>(`${org}/giang-vien-quyens/${id}`),
  },
};
