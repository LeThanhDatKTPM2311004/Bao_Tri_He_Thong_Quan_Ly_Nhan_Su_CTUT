import { ROLES, ROLE_LABELS, USER_SELECTABLE_ROLE_GROUPS } from '../../config/roles.js';

/**
 * Vai trò có thể ký/duyệt trong quy trình — khớp danh mục quyền
 * (không gồm admin, giảng viên thường).
 */
export const WORKFLOW_SIGNER_ROLE_VALUES = [
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.FACULTY_MANAGER,
  ROLES.DEPUTY_FACULTY_MANAGER,
  ROLES.DEPARTMENT_CHAIR,
  ROLES.DEPUTY_DEPARTMENT_CHAIR,
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.ACADEMIC_ADVISOR,
  ROLES.OFFICE_STAFF,
];

/** Vai trò phòng/trung tâm — bước quy trình cần chọn đúng đơn vị (User.department) */
export const WORKFLOW_OFFICE_UNIT_ROLES = new Set([
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.PHONG_ASSISTANT,
]);

export const isWorkflowOfficeUnitRole = (role) => WORKFLOW_OFFICE_UNIT_ROLES.has(role);

/** Nhóm đơn vị để lọc danh sách phòng vs trung tâm */
export const officeUnitKindForRole = (role) => {
  if (
    role === ROLES.DEPARTMENT_HEAD ||
    role === ROLES.DEPUTY_DEPARTMENT_HEAD ||
    role === ROLES.PHONG_ASSISTANT
  ) {
    return 'phong';
  }
  if (role === ROLES.CENTER_DIRECTOR || role === ROLES.DEPUTY_CENTER_DIRECTOR) return 'trung_tam';
  return null;
};

const signerSet = new Set(WORKFLOW_SIGNER_ROLE_VALUES);

/**
 * Options (có group) — validation + cấu hình bước quy trình.
 * Không gồm Sinh viên: SV chỉ nộp đơn (ký trên form), không phải bước duyệt.
 * fromRole bước 1 vẫn có thể = student (người nộp).
 */
export const WORKFLOW_APPROVER_ROLES = [
  ...USER_SELECTABLE_ROLE_GROUPS.flatMap((g) =>
    g.roles
      .filter((role) => signerSet.has(role))
      .map((value) => ({
        value,
        label: ROLE_LABELS[value] || value,
        group: g.key,
        groupLabel: g.label,
        requiresUnit: isWorkflowOfficeUnitRole(value),
        unitKind: officeUnitKindForRole(value),
      })),
  ),
  // CVHT là nhiệm vụ (không còn trong form Người dùng) nhưng vẫn chọn được trong bước quy trình
  {
    value: ROLES.ACADEMIC_ADVISOR,
    label: ROLE_LABELS[ROLES.ACADEMIC_ADVISOR] || 'Cố vấn học tập',
    group: 'he_thong',
    groupLabel: 'Hệ thống',
    requiresUnit: false,
    unitKind: null,
  },
  {
    value: ROLES.PHONG_ASSISTANT,
    label: ROLE_LABELS[ROLES.PHONG_ASSISTANT] || 'Trợ lý phòng',
    group: 'phong',
    groupLabel: 'Phòng',
    requiresUnit: true,
    unitKind: 'phong',
  },
];

export const DEFAULT_WORKFLOW_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Cố vấn học tập',
    fromRole: ROLES.STUDENT,
    role: ROLES.ACADEMIC_ADVISOR,
    action: 'review',
    isRequired: true,
  },
  {
    stepOrder: 2,
    stepName: 'Trưởng bộ môn',
    fromRole: ROLES.ACADEMIC_ADVISOR,
    role: ROLES.DEPARTMENT_CHAIR,
    action: 'approve',
    isRequired: true,
  },
  {
    stepOrder: 3,
    stepName: 'Trưởng khoa',
    fromRole: ROLES.DEPARTMENT_CHAIR,
    role: ROLES.FACULTY_MANAGER,
    action: 'sign',
    isRequired: true,
  },
];
