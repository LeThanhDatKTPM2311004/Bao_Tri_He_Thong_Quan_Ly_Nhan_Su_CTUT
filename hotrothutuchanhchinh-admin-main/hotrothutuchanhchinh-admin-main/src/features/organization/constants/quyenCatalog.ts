/** Danh mục mã quyền tổ chức — nguồn từ ngữ/nhóm dùng chung toàn hệ thống */

export const QUYEN_GROUPS = [
  { key: 'ban_giam_hieu', label: 'Ban giám hiệu' },
  { key: 'khoa', label: 'Khoa' },
  { key: 'bo_mon', label: 'Bộ môn' },
  { key: 'phong', label: 'Phòng' },
  { key: 'trung_tam', label: 'Trung tâm' },
  { key: 'giang_day', label: 'Giảng dạy' },
  { key: 'hanh_chinh', label: 'Hành chính' },
  { key: 'he_thong', label: 'Hệ thống' },
] as const;

export type QuyenGroupKey = (typeof QUYEN_GROUPS)[number]['key'];

/** Chuẩn hoá key nhóm cũ → mới */
export const normalizeQuyenGroup = (group?: string): QuyenGroupKey | 'khac' => {
  if (!group) return 'khac';
  if (group === 'ban_lanh_dao') return 'ban_giam_hieu';
  if (QUYEN_GROUPS.some((g) => g.key === group)) return group as QuyenGroupKey;
  return 'khac';
};

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
] as const;

export const QUYEN_CODE_OPTIONS = QUYEN_GROUPS.map((g) => ({
  label: g.label,
  options: QUYEN_CATALOG.filter((q) => q.group === g.key).map((q) => ({
    value: q.code,
    label: `${q.code} — ${q.name}`,
  })),
})).filter((g) => g.options.length > 0);

export const quyenNameByCode = (code: string) =>
  QUYEN_CATALOG.find((q) => q.code === code)?.name ?? code;

export const quyenGroupByCode = (code: string): QuyenGroupKey | 'khac' => {
  const found = QUYEN_CATALOG.find((q) => q.code === code);
  return found ? normalizeQuyenGroup(found.group) : 'khac';
};

export const quyenGroupLabel = (group: string) => {
  const key = normalizeQuyenGroup(group);
  return QUYEN_GROUPS.find((g) => g.key === key)?.label ?? 'Khác';
};
