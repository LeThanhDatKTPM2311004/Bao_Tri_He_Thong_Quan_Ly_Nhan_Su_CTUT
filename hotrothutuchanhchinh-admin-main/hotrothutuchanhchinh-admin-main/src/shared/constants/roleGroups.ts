import { ROLES, type Role } from './roles';

/** Cố vấn, Trưởng/Phó bộ môn — bước duyệt đầu/giữa */
export const APPROVER_ROLES: Role[] = [
  ROLES.ACADEMIC_ADVISOR,
  ROLES.DEPARTMENT_CHAIR,
  ROLES.DEPUTY_DEPARTMENT_CHAIR,
];

/** Trưởng/Phó khoa */
export const FACULTY_LEADERSHIP_ROLES: Role[] = [
  ROLES.FACULTY_MANAGER,
  ROLES.DEPUTY_FACULTY_MANAGER,
];

/** Phòng, Trung tâm và Hành chính */
export const OFFICE_LEADERSHIP_ROLES: Role[] = [
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.OFFICE_STAFF,
];

/** Ban giám hiệu */
export const EXECUTIVE_ROLES: Role[] = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL];

/** Trợ lý khoa / phòng / trung tâm — theo dõi, không ký */
export const ASSISTANT_ROLES: Role[] = [
  ROLES.KHOA_ASSISTANT,
  ROLES.PHONG_ASSISTANT,
  ROLES.TRUNG_TAM_ASSISTANT,
];

export const isAssistant = (role?: string) => !!role && ASSISTANT_ROLES.includes(role as Role);

export const STAFF_ROLES: Role[] = [
  ROLES.LECTURER,
  ...APPROVER_ROLES,
  ...FACULTY_LEADERSHIP_ROLES,
  ...OFFICE_LEADERSHIP_ROLES,
  ...EXECUTIVE_ROLES,
  ...ASSISTANT_ROLES,
  // Tài khoản cũ
  ROLES.FACULTY_ASSISTANT,
  ROLES.STUDENT_AFFAIRS,
];

/** Ban giám hiệu + cán bộ quản lý */
export const MANAGER_ROLES: Role[] = [
  ...FACULTY_LEADERSHIP_ROLES,
  ...OFFICE_LEADERSHIP_ROLES,
  ...EXECUTIVE_ROLES,
];

export const isAdmin = (role?: string) => role === ROLES.ADMIN;
export const isStudent = (role?: string) => role === ROLES.STUDENT;
export const isStaff = (role?: string) => !!role && STAFF_ROLES.includes(role as Role);
export const isExecutive = (role?: string) => !!role && EXECUTIVE_ROLES.includes(role as Role);
export const isManager = (role?: string) => !!role && MANAGER_ROLES.includes(role as Role);
