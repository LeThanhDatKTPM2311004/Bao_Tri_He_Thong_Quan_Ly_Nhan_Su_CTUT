import { Suspense, lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import { MainLayout } from '@/shared/components/layout/MainLayout';
import { AuthLayout } from '@/shared/components/layout/AuthLayout';
import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleGuard } from './RoleGuard';
import { RouteAccessGuard } from './RouteAccessGuard';

import { LoginPage } from '@/features/auth/pages/LoginPage';
import { ForceChangePasswordPage } from '@/features/auth/pages/ForceChangePasswordPage';
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage';

import { ROLES } from '@/shared/constants/roles';

const DashboardPage = lazy(() =>
  import('@/features/dashboard/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const FormsListPage = lazy(() =>
  import('@/features/forms/pages/FormsListPage').then((m) => ({ default: m.FormsListPage })),
);
const BulkFormImportPage = lazy(() =>
  import('@/features/forms/pages/BulkFormImportPage').then((m) => ({
    default: m.BulkFormImportPage,
  })),
);
const PendingApprovalsPage = lazy(() =>
  import('@/features/workflows/pages/PendingApprovalsPage').then((m) => ({
    default: m.PendingApprovalsPage,
  })),
);
const ProcessedApprovalsPage = lazy(() =>
  import('@/features/workflows/pages/ProcessedApprovalsPage').then((m) => ({
    default: m.ProcessedApprovalsPage,
  })),
);
const AssistantMonitorPage = lazy(() =>
  import('@/features/workflows/pages/AssistantMonitorPage').then((m) => ({
    default: m.AssistantMonitorPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const ReportsPage = lazy(() =>
  import('@/features/reports/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })),
);
const AssistantReportsPage = lazy(() =>
  import('@/features/reports/pages/AssistantReportsPage').then((m) => ({
    default: m.AssistantReportsPage,
  })),
);
const UsersPage = lazy(() =>
  import('@/features/users/pages/UsersPage').then((m) => ({ default: m.UsersPage })),
);
const AccountSettingsPage = lazy(() =>
  import('@/features/account/pages/AccountSettingsPage').then((m) => ({
    default: m.AccountSettingsPage,
  })),
);
const KhoaBoMonPage = lazy(() =>
  import('@/features/organization/pages/KhoaBoMonPage').then((m) => ({ default: m.KhoaBoMonPage })),
);
const LopSinhVienPage = lazy(() =>
  import('@/features/organization/pages/LopSinhVienPage').then((m) => ({
    default: m.LopSinhVienPage,
  })),
);
const GiangVienPage = lazy(() =>
  import('@/features/organization/pages/GiangVienPage').then((m) => ({ default: m.GiangVienPage })),
);
const QuyenPage = lazy(() =>
  import('@/features/organization/pages/QuyenPage').then((m) => ({ default: m.QuyenPage })),
);

const withSuspense = (element: ReactNode) => (
  <Suspense fallback={<LoadingSpinner tip="Đang tải trang..." />}>{element}</Suspense>
);

const adminOnly = (element: ReactNode) => (
  <RoleGuard allowedRoles={[ROLES.ADMIN]}>{element}</RoleGuard>
);

const guarded = (path: string, element: ReactNode) => (
  <RouteAccessGuard path={path}>{element}</RouteAccessGuard>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: withSuspense(guarded('/dashboard', <DashboardPage />)),
      },
      { path: 'forms', element: withSuspense(adminOnly(<FormsListPage />)) },
      {
        path: 'forms/bulk-import',
        element: withSuspense(guarded('/forms/bulk-import', <BulkFormImportPage />)),
      },
      {
        path: 'workflows/pending',
        element: withSuspense(guarded('/workflows/pending', <PendingApprovalsPage />)),
      },
      {
        path: 'workflows/processed',
        element: withSuspense(guarded('/workflows/processed', <ProcessedApprovalsPage />)),
      },
      {
        path: 'workflows/assistant-monitor',
        element: withSuspense(guarded('/workflows/assistant-monitor', <AssistantMonitorPage />)),
      },
      {
        path: 'notifications',
        element: withSuspense(guarded('/notifications', <NotificationsPage />)),
      },
      { path: 'reports', element: withSuspense(guarded('/reports', <ReportsPage />)) },
      {
        path: 'reports/assistant',
        element: withSuspense(guarded('/reports/assistant', <AssistantReportsPage />)),
      },
      { path: 'account', element: withSuspense(guarded('/account', <AccountSettingsPage />)) },
      { path: 'users', element: withSuspense(adminOnly(<UsersPage />)) },
      {
        path: 'organization/khoa-bo-mon',
        element: withSuspense(adminOnly(<KhoaBoMonPage />)),
      },
      {
        path: 'organization/lop-sinh-vien',
        element: withSuspense(adminOnly(<LopSinhVienPage />)),
      },
      {
        path: 'organization/giang-vien',
        element: withSuspense(adminOnly(<GiangVienPage />)),
      },
      { path: 'organization/quyen', element: withSuspense(adminOnly(<QuyenPage />)) },
    ],
  },
  {
    path: '/auth/change-password',
    element: (
      <ProtectedRoute>
        <ForceChangePasswordPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <LoginPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);
