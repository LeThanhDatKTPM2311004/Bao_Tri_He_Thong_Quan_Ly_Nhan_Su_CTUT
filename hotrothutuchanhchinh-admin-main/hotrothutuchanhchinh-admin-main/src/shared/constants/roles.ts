export const ROLES = {
  STUDENT: 'student',

  PRINCIPAL: 'principal',
  VICE_PRINCIPAL: 'vice_principal',

  FACULTY_MANAGER: 'faculty_manager',
  DEPUTY_FACULTY_MANAGER: 'deputy_faculty_manager',

  DEPARTMENT_CHAIR: 'department_chair',
  DEPUTY_DEPARTMENT_CHAIR: 'deputy_department_chair',

  DEPARTMENT_HEAD: 'department_head',
  DEPUTY_DEPARTMENT_HEAD: 'deputy_department_head',

  CENTER_DIRECTOR: 'center_director',
  DEPUTY_CENTER_DIRECTOR: 'deputy_center_director',

  /** Trợ lý — theo dõi/nhắc lãnh đạo đơn vị ký, không ký duyệt */
  KHOA_ASSISTANT: 'khoa_assistant',
  PHONG_ASSISTANT: 'phong_assistant',
  TRUNG_TAM_ASSISTANT: 'trung_tam_assistant',

  ACADEMIC_ADVISOR: 'academic_advisor',
  LECTURER: 'lecturer',

  OFFICE_STAFF: 'office_staff',

  /** @deprecated — giữ để hiển thị tài khoản cũ */
  FACULTY_ASSISTANT: 'faculty_assistant',
  /** @deprecated */
  STUDENT_AFFAIRS: 'student_affairs',

  ADMIN: 'admin',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  student: 'Sinh viên',
  principal: 'Hiệu trưởng',
  vice_principal: 'Phó Hiệu trưởng',
  faculty_manager: 'Trưởng khoa',
  deputy_faculty_manager: 'Phó Trưởng khoa',
  department_chair: 'Trưởng bộ môn',
  deputy_department_chair: 'Phó Trưởng bộ môn',
  department_head: 'Trưởng phòng',
  deputy_department_head: 'Phó Trưởng phòng',
  center_director: 'Giám đốc Trung tâm',
  deputy_center_director: 'Phó Giám đốc Trung tâm',
  khoa_assistant: 'Trợ lý khoa',
  phong_assistant: 'Trợ lý phòng',
  trung_tam_assistant: 'Trợ lý trung tâm',
  academic_advisor: 'Cố vấn học tập',
  lecturer: 'Giảng viên',
  office_staff: 'Nhân viên',
  faculty_assistant: 'Trưởng bộ môn',
  student_affairs: 'Phòng công tác sinh viên',
  admin: 'Quản trị viên',
};

/** Nhóm vai trò — khớp trang Quản lý quyền */
export const ROLE_GROUPS = [
  { key: 'ban_giam_hieu', label: 'Ban giám hiệu' },
  { key: 'khoa', label: 'Khoa' },
  { key: 'bo_mon', label: 'Bộ môn' },
  { key: 'phong', label: 'Phòng' },
  { key: 'trung_tam', label: 'Trung tâm' },
  { key: 'giang_day', label: 'Giảng dạy' },
  { key: 'hanh_chinh', label: 'Hành chính' },
  { key: 'he_thong', label: 'Hệ thống' },
] as const;

/** Vai trò chọn được trên form Người dùng (theo nhóm quyền) */
export const USER_SELECTABLE_ROLE_GROUPS: { key: string; label: string; roles: Role[] }[] = [
  {
    key: 'ban_giam_hieu',
    label: 'Ban giám hiệu',
    roles: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
  },
  {
    key: 'khoa',
    label: 'Khoa',
    roles: [ROLES.FACULTY_MANAGER, ROLES.DEPUTY_FACULTY_MANAGER, ROLES.KHOA_ASSISTANT],
  },
  {
    key: 'bo_mon',
    label: 'Bộ môn',
    roles: [ROLES.DEPARTMENT_CHAIR, ROLES.DEPUTY_DEPARTMENT_CHAIR],
  },
  {
    key: 'phong',
    label: 'Phòng',
    roles: [ROLES.DEPARTMENT_HEAD, ROLES.DEPUTY_DEPARTMENT_HEAD, ROLES.PHONG_ASSISTANT],
  },
  {
    key: 'trung_tam',
    label: 'Trung tâm',
    roles: [ROLES.CENTER_DIRECTOR, ROLES.DEPUTY_CENTER_DIRECTOR, ROLES.TRUNG_TAM_ASSISTANT],
  },
  {
    key: 'giang_day',
    label: 'Giảng dạy',
    roles: [ROLES.LECTURER],
  },
  {
    key: 'hanh_chinh',
    label: 'Hành chính',
    roles: [ROLES.OFFICE_STAFF],
  },
  {
    key: 'he_thong',
    label: 'Hệ thống',
    roles: [ROLES.STUDENT, ROLES.ADMIN],
  },
];

export const USER_SELECTABLE_ROLES: Role[] = USER_SELECTABLE_ROLE_GROUPS.flatMap((g) => g.roles);

/** OptGroup options cho Select Ant Design */
export const USER_ROLE_OPTIONS = USER_SELECTABLE_ROLE_GROUPS.map((g) => ({
  label: g.label,
  options: g.roles.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  })),
}));
