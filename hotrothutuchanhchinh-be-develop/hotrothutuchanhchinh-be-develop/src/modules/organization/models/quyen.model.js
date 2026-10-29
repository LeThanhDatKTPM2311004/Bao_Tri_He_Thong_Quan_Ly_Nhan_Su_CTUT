import mongoose from 'mongoose';
import { ROLES } from '../../../config/roles.js';

/** Nhóm quyền — nguồn từ ngữ/nhóm dùng chung toàn hệ thống */
export const QUYEN_GROUPS = [
  { key: 'ban_giam_hieu', label: 'Ban giám hiệu' },
  { key: 'khoa', label: 'Khoa' },
  { key: 'bo_mon', label: 'Bộ môn' },
  { key: 'phong', label: 'Phòng' },
  { key: 'trung_tam', label: 'Trung tâm' },
  { key: 'giang_day', label: 'Giảng dạy' },
  { key: 'hanh_chinh', label: 'Hành chính' },
  { key: 'he_thong', label: 'Hệ thống' },
];

/** Danh mục chuẩn (seed + validate tạo mới) */
export const QUYEN_CATALOG = [
  // Ban giám hiệu
  { code: 'hieu_truong', name: 'Hiệu trưởng', group: 'ban_giam_hieu', description: 'Ban giám hiệu — Hiệu trưởng' },
  { code: 'pho_hieu_truong', name: 'Phó Hiệu trưởng', group: 'ban_giam_hieu', description: 'Ban giám hiệu — Phó Hiệu trưởng' },
  { code: 'ban_giam_hieu', name: 'Ban giám hiệu', group: 'ban_giam_hieu', description: 'Ban giám hiệu — tương đương Hiệu trưởng' },
  // Khoa
  { code: 'truong_khoa', name: 'Trưởng khoa', group: 'khoa', description: 'Khoa — Trưởng khoa' },
  { code: 'pho_khoa', name: 'Phó Trưởng khoa', group: 'khoa', description: 'Khoa — Phó Trưởng khoa' },
  { code: 'tro_ly_khoa', name: 'Trợ lý khoa', group: 'khoa', description: 'Khoa — Trợ lý theo dõi/nhắc trưởng hoặc phó khoa ký, không ký duyệt' },
  // Bộ môn
  { code: 'truong_bo_mon', name: 'Trưởng bộ môn', group: 'bo_mon', description: 'Bộ môn — Trưởng bộ môn' },
  { code: 'pho_bo_mon', name: 'Phó Trưởng bộ môn', group: 'bo_mon', description: 'Bộ môn — Phó Trưởng bộ môn' },
  // Phòng
  { code: 'truong_phong', name: 'Trưởng phòng', group: 'phong', description: 'Phòng — Trưởng phòng' },
  { code: 'pho_phong', name: 'Phó Trưởng phòng', group: 'phong', description: 'Phòng — Phó Trưởng phòng' },
  { code: 'tro_ly_phong', name: 'Trợ lý phòng', group: 'phong', description: 'Phòng — Trợ lý theo dõi/nhắc trưởng hoặc phó phòng ký, không ký duyệt' },
  // Trung tâm
  { code: 'giam_doc_trung_tam', name: 'Giám đốc Trung tâm', group: 'trung_tam', description: 'Trung tâm — Giám đốc' },
  { code: 'pho_giam_doc_trung_tam', name: 'Phó Giám đốc Trung tâm', group: 'trung_tam', description: 'Trung tâm — Phó Giám đốc' },
  { code: 'tro_ly_trung_tam', name: 'Trợ lý trung tâm', group: 'trung_tam', description: 'Trung tâm — Trợ lý theo dõi/nhắc giám đốc hoặc phó giám đốc ký, không ký duyệt' },
  // Giảng dạy
  { code: 'giang_vien_cao_cap', name: 'Giảng viên cao cấp', group: 'giang_day', description: 'Giảng dạy — Giảng viên cao cấp' },
  { code: 'giang_vien_chinh', name: 'Giảng viên chính', group: 'giang_day', description: 'Giảng dạy — Giảng viên chính' },
  { code: 'giang_vien', name: 'Giảng viên', group: 'giang_day', description: 'Giảng dạy — Giảng viên' },
  { code: 'tro_giang', name: 'Trợ giảng', group: 'giang_day', description: 'Giảng dạy — Trợ giảng' },
  // Hành chính
  { code: 'chuyen_vien_chinh', name: 'Chuyên viên chính', group: 'hanh_chinh', description: 'Hành chính — Chuyên viên chính' },
  { code: 'chuyen_vien', name: 'Chuyên viên', group: 'hanh_chinh', description: 'Hành chính — Chuyên viên' },
  { code: 'nhan_vien', name: 'Nhân viên', group: 'hanh_chinh', description: 'Hành chính — Nhân viên' },
  { code: 'ke_toan', name: 'Kế toán', group: 'hanh_chinh', description: 'Hành chính — Kế toán' },
  { code: 'thu_ky', name: 'Thư ký', group: 'hanh_chinh', description: 'Hành chính — Thư ký' },
  { code: 'van_thu', name: 'Văn thư', group: 'hanh_chinh', description: 'Hành chính — Văn thư' },
  { code: 'ky_thuat_vien', name: 'Kỹ thuật viên', group: 'hanh_chinh', description: 'Hành chính — Kỹ thuật viên' },
  // Hệ thống
  { code: 'sinh_vien', name: 'Sinh viên', group: 'he_thong', description: 'Hệ thống — Sinh viên' },
  { code: 'quan_tri_vien', name: 'Quản trị viên', group: 'he_thong', description: 'Hệ thống — Quản trị viên' },
  { code: 'co_van_hoc_tap', name: 'Cố vấn học tập', group: 'he_thong', description: 'Hệ thống — Cố vấn học tập' },
];

export const QUYEN_CODES = QUYEN_CATALOG.map((q) => q.code);

/** Map mã quyền tổ chức → User.role (không map sinh_vien/quan_tri_vien khi gán GV) */
export const QUYEN_CODE_TO_ROLE = {
  hieu_truong: ROLES.PRINCIPAL,
  pho_hieu_truong: ROLES.VICE_PRINCIPAL,
  ban_giam_hieu: ROLES.PRINCIPAL,
  truong_khoa: ROLES.FACULTY_MANAGER,
  pho_khoa: ROLES.DEPUTY_FACULTY_MANAGER,
  tro_ly_khoa: ROLES.KHOA_ASSISTANT,
  /** @deprecated mã cũ — giữ map tạm nếu còn dữ liệu chưa migrate */
  tro_ly_truong_khoa: ROLES.KHOA_ASSISTANT,
  truong_bo_mon: ROLES.DEPARTMENT_CHAIR,
  pho_bo_mon: ROLES.DEPUTY_DEPARTMENT_CHAIR,
  truong_phong: ROLES.DEPARTMENT_HEAD,
  pho_phong: ROLES.DEPUTY_DEPARTMENT_HEAD,
  tro_ly_phong: ROLES.PHONG_ASSISTANT,
  /** @deprecated mã cũ */
  tro_ly_truong_phong: ROLES.PHONG_ASSISTANT,
  giam_doc_trung_tam: ROLES.CENTER_DIRECTOR,
  pho_giam_doc_trung_tam: ROLES.DEPUTY_CENTER_DIRECTOR,
  tro_ly_trung_tam: ROLES.TRUNG_TAM_ASSISTANT,
  giang_vien_cao_cap: ROLES.LECTURER,
  giang_vien_chinh: ROLES.LECTURER,
  giang_vien: ROLES.LECTURER,
  tro_giang: ROLES.LECTURER,
  chuyen_vien_chinh: ROLES.OFFICE_STAFF,
  chuyen_vien: ROLES.OFFICE_STAFF,
  nhan_vien: ROLES.OFFICE_STAFF,
  ke_toan: ROLES.OFFICE_STAFF,
  thu_ky: ROLES.OFFICE_STAFF,
  van_thu: ROLES.OFFICE_STAFF,
  ky_thuat_vien: ROLES.OFFICE_STAFF,
  // co_van_hoc_tap: nhiệm vụ — không map thành User.role
};

/** Ưu tiên cao → thấp khi GV có nhiều quyền */
export const QUYEN_ROLE_PRIORITY = [
  'hieu_truong',
  'pho_hieu_truong',
  'ban_giam_hieu',
  'truong_khoa',
  'pho_khoa',
  'tro_ly_khoa',
  'truong_phong',
  'pho_phong',
  'tro_ly_phong',
  'giam_doc_trung_tam',
  'pho_giam_doc_trung_tam',
  'tro_ly_trung_tam',
  'truong_bo_mon',
  'pho_bo_mon',
  'chuyen_vien_chinh',
  'chuyen_vien',
  'giang_vien_cao_cap',
  'giang_vien_chinh',
  'giang_vien',
  'tro_giang',
  'nhan_vien',
  'ke_toan',
  'thu_ky',
  'van_thu',
  'ky_thuat_vien',
];

const quyenSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    group: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const Quyen = mongoose.model('Quyen', quyenSchema);
export default Quyen;
