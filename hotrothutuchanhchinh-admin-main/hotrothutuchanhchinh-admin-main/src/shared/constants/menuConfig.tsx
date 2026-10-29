import type { ReactNode } from 'react';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  PartitionOutlined,
  CheckCircleOutlined,
  BellOutlined,
  AreaChartOutlined,
  ApartmentOutlined,
  TeamOutlined,
  ReadOutlined,
  SafetyOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import { ROLES, type Role } from './roles';
import { isAdmin, isAssistant, isStaff, isStudent } from './roleGroups';

export type SidebarMenuItem = {
  key: string;
  icon: ReactNode;
  label: string;
};

/** Tạm khóa mục «Nhập đơn từ Excel». Đổi thành true để mở lại. */
export const BULK_FORM_IMPORT_ENABLED = false;

const bulkImportMenuItem: SidebarMenuItem = {
  key: '/forms/bulk-import',
  icon: <FileExcelOutlined />,
  label: 'Nhập đơn từ Excel',
};

const pendingLabel = (role?: string) => {
  if (isAdmin(role)) return 'Quản lý quy trình';
  return 'Hồ sơ chờ ký';
};

const portalSubtitle = (role?: string) => {
  if (isAdmin(role)) return 'Admin Management';
  if (isStudent(role)) return 'Student Portal';
  if (isAssistant(role)) return 'Assistant Portal';
  return 'Staff Portal';
};

export const getPortalSubtitle = portalSubtitle;

/** [ADMIN-PORTAL] Sidebar — sinh viên dùng repo hotrothutuchanhchinh-fe, không dùng portal này */
export function getSidebarMenuItems(role?: Role | string): SidebarMenuItem[] {
  const r = role as Role | undefined;

  if (isAdmin(r)) {
    return [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
      { key: '/users', icon: <UserOutlined />, label: 'Quản lý người dùng' },
      { key: '/organization/khoa-bo-mon', icon: <ApartmentOutlined />, label: 'Khoa & Bộ môn' },
      { key: '/organization/lop-sinh-vien', icon: <TeamOutlined />, label: 'Lớp & Sinh viên' },
      { key: '/organization/giang-vien', icon: <ReadOutlined />, label: 'Giảng viên' },
      { key: '/organization/quyen', icon: <SafetyOutlined />, label: 'Quản lý quyền' },
      { key: '/forms', icon: <FileTextOutlined />, label: 'Mẫu Word gốc' },
      ...(BULK_FORM_IMPORT_ENABLED ? [bulkImportMenuItem] : []),
      { key: '/workflows/pending', icon: <PartitionOutlined />, label: pendingLabel(r) },
      { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
      { key: '/reports', icon: <AreaChartOutlined />, label: 'Báo cáo & Thống kê' },
    ];
  }

  if (isStudent(r)) {
    return [{ key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' }];
  }

  if (isAssistant(r)) {
    return [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
      ...(r === ROLES.PHONG_ASSISTANT
        ? [{ key: '/workflows/pending', icon: <PartitionOutlined />, label: 'Hồ sơ chờ kiểm tra' }]
        : []),
      {
        key: '/workflows/assistant-monitor',
        icon: <PartitionOutlined />,
        label: 'Theo dõi đơn đơn vị',
      },
      { key: '/reports/assistant', icon: <AreaChartOutlined />, label: 'Thống kê đơn vị' },
      { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
      { key: '/account', icon: <IdcardOutlined />, label: 'Tài khoản' },
    ];
  }

  if (isStaff(r)) {
    return [
      { key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' },
      ...(BULK_FORM_IMPORT_ENABLED ? [bulkImportMenuItem] : []),
      { key: '/workflows/pending', icon: <PartitionOutlined />, label: pendingLabel(r) },
      { key: '/workflows/processed', icon: <CheckCircleOutlined />, label: 'Hồ sơ đã ký / đã xử lý' },
      { key: '/notifications', icon: <BellOutlined />, label: 'Thông báo' },
      { key: '/account', icon: <IdcardOutlined />, label: 'Tài khoản & chữ ký số' },
    ];
  }

  return [{ key: '/dashboard', icon: <DashboardOutlined />, label: 'Tổng quan' }];
}

/** Route chỉ admin */
export const ADMIN_ONLY_PATHS = [
  '/users',
  '/forms',
  '/organization/khoa-bo-mon',
  '/organization/lop-sinh-vien',
  '/organization/giang-vien',
  '/organization/quyen',
];

/** Route chỉ cán bộ ký/duyệt (không gồm sinh viên / trợ lý) */
export const STAFF_ONLY_PATHS = ['/workflows/pending', '/workflows/processed'];

/** Route chỉ trợ lý theo dõi */
export const ASSISTANT_ONLY_PATHS = ['/workflows/assistant-monitor', '/reports/assistant'];

export function canAccessPath(path: string, role?: string): boolean {
  if (!role) return path === '/dashboard';

  // Nhập đơn Excel: admin + cán bộ (không gồm trợ lý / sinh viên)
  if (path.startsWith('/forms/bulk-import')) {
    if (!BULK_FORM_IMPORT_ENABLED) return false;
    if (isAssistant(role) || isStudent(role)) return false;
    return isAdmin(role) || isStaff(role);
  }

  if (ADMIN_ONLY_PATHS.some((p) => path.startsWith(p))) {
    return role === ROLES.ADMIN;
  }

  if (ASSISTANT_ONLY_PATHS.some((p) => path.startsWith(p))) {
    return isAssistant(role);
  }

  if (path.startsWith('/workflows/pending') && role === ROLES.PHONG_ASSISTANT) {
    return true;
  }

  if (STAFF_ONLY_PATHS.some((p) => path.startsWith(p))) {
    if (isAssistant(role)) return false;
    return isStaff(role) || role === ROLES.ADMIN;
  }

  if (path.startsWith('/account')) {
    return true;
  }

  if (path === '/reports' || path.startsWith('/reports/')) {
    if (path.startsWith('/reports/assistant')) return isAssistant(role);
    return role === ROLES.ADMIN;
  }

  if (path.startsWith('/forms')) {
    return role === ROLES.ADMIN;
  }

  if (isStudent(role)) {
    return path === '/dashboard' || path.startsWith('/auth');
  }

  return true;
}
