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

  /** Trợ lý — theo dõi đơn vị. Trợ lý phòng còn kiểm tra hồ sơ được giao, không ký PDF */
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
};

export const ROLE_LABELS = {
  [ROLES.STUDENT]: 'Sinh viên',
  [ROLES.PRINCIPAL]: 'Hiệu trưởng',
  [ROLES.VICE_PRINCIPAL]: 'Phó Hiệu trưởng',
  [ROLES.FACULTY_MANAGER]: 'Trưởng khoa',
  [ROLES.DEPUTY_FACULTY_MANAGER]: 'Phó Trưởng khoa',
  [ROLES.DEPARTMENT_CHAIR]: 'Trưởng bộ môn',
  [ROLES.DEPUTY_DEPARTMENT_CHAIR]: 'Phó Trưởng bộ môn',
  [ROLES.DEPARTMENT_HEAD]: 'Trưởng phòng',
  [ROLES.DEPUTY_DEPARTMENT_HEAD]: 'Phó Trưởng phòng',
  [ROLES.CENTER_DIRECTOR]: 'Giám đốc Trung tâm',
  [ROLES.DEPUTY_CENTER_DIRECTOR]: 'Phó Giám đốc Trung tâm',
  [ROLES.KHOA_ASSISTANT]: 'Trợ lý khoa',
  [ROLES.PHONG_ASSISTANT]: 'Trợ lý phòng',
  [ROLES.TRUNG_TAM_ASSISTANT]: 'Trợ lý trung tâm',
  [ROLES.ACADEMIC_ADVISOR]: 'Cố vấn học tập',
  [ROLES.LECTURER]: 'Giảng viên',
  [ROLES.OFFICE_STAFF]: 'Nhân viên',
  [ROLES.FACULTY_ASSISTANT]: 'Trưởng bộ môn',
  [ROLES.STUDENT_AFFAIRS]: 'Phòng công tác sinh viên',
  [ROLES.ADMIN]: 'Quản trị viên',
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
];

/** Vai trò chọn được trên form Người dùng (theo nhóm quyền) */
export const USER_SELECTABLE_ROLE_GROUPS = [
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

export const USER_SELECTABLE_ROLES = USER_SELECTABLE_ROLE_GROUPS.flatMap((g) => g.roles);

export const USER_ROLE_OPTIONS = USER_SELECTABLE_ROLE_GROUPS.map((g) => ({
  label: g.label,
  options: g.roles.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
  })),
}));

export const ROLE_LIST = Object.values(ROLES);

export const PERMISSIONS = {
  SUBMISSION_CREATE: 'submission:create',
  SUBMISSION_VIEW_OWN: 'submission:view:own',
  SUBMISSION_VIEW_ALL: 'submission:view:all',
  WORKFLOW_APPROVE: 'workflow:approve',
  WORKFLOW_REJECT: 'workflow:reject',
  SIGNATURE_SIGN: 'signature:sign',
  USER_MANAGE: 'user:manage',
  REPORT_VIEW: 'report:view',
  AUDIT_VIEW: 'audit:view',
  SETTINGS_MANAGE: 'settings:manage',
};

const STAFF_WORKFLOW = [
  PERMISSIONS.WORKFLOW_APPROVE,
  PERMISSIONS.WORKFLOW_REJECT,
  PERMISSIONS.SIGNATURE_SIGN,
];

/** Trợ lý khoa / trung tâm: theo dõi + báo cáo, không ký duyệt */
const ASSISTANT_PERMISSIONS = [PERMISSIONS.REPORT_VIEW];

/** Trợ lý phòng: kiểm tra và trả hồ sơ, không ký PDF */
const PHONG_ASSISTANT_PERMISSIONS = [
  PERMISSIONS.REPORT_VIEW,
  PERMISSIONS.WORKFLOW_APPROVE,
  PERMISSIONS.WORKFLOW_REJECT,
];

export const ASSISTANT_ROLES = [
  ROLES.KHOA_ASSISTANT,
  ROLES.PHONG_ASSISTANT,
  ROLES.TRUNG_TAM_ASSISTANT,
];

export const isAssistantRole = (role) => ASSISTANT_ROLES.includes(role);

export const ROLE_PERMISSIONS = {
  [ROLES.STUDENT]: [],
  [ROLES.PRINCIPAL]: [...STAFF_WORKFLOW, PERMISSIONS.REPORT_VIEW],
  [ROLES.VICE_PRINCIPAL]: [...STAFF_WORKFLOW, PERMISSIONS.REPORT_VIEW],
  [ROLES.FACULTY_MANAGER]: [...STAFF_WORKFLOW, PERMISSIONS.REPORT_VIEW],
  [ROLES.DEPUTY_FACULTY_MANAGER]: STAFF_WORKFLOW,
  [ROLES.DEPARTMENT_CHAIR]: STAFF_WORKFLOW,
  [ROLES.DEPUTY_DEPARTMENT_CHAIR]: STAFF_WORKFLOW,
  [ROLES.DEPARTMENT_HEAD]: STAFF_WORKFLOW,
  [ROLES.DEPUTY_DEPARTMENT_HEAD]: STAFF_WORKFLOW,
  [ROLES.CENTER_DIRECTOR]: STAFF_WORKFLOW,
  [ROLES.DEPUTY_CENTER_DIRECTOR]: STAFF_WORKFLOW,
  [ROLES.KHOA_ASSISTANT]: ASSISTANT_PERMISSIONS,
  [ROLES.PHONG_ASSISTANT]: PHONG_ASSISTANT_PERMISSIONS,
  [ROLES.TRUNG_TAM_ASSISTANT]: ASSISTANT_PERMISSIONS,
  [ROLES.ACADEMIC_ADVISOR]: STAFF_WORKFLOW,
  [ROLES.LECTURER]: [],
  [ROLES.OFFICE_STAFF]: [...STAFF_WORKFLOW, PERMISSIONS.SUBMISSION_VIEW_ALL],
  [ROLES.FACULTY_ASSISTANT]: STAFF_WORKFLOW,
  [ROLES.STUDENT_AFFAIRS]: [...STAFF_WORKFLOW, PERMISSIONS.REPORT_VIEW],
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
};
