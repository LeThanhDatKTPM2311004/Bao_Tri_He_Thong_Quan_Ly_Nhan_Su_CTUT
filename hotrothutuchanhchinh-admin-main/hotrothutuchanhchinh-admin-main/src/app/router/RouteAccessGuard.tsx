import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { canAccessPath } from '@/shared/constants/menuConfig';

interface RouteAccessGuardProps {
  path: string;
  children: React.ReactNode;
}

/** Chặn truy cập URL trực tiếp khi vai trò không có quyền */
export function RouteAccessGuard({ path, children }: RouteAccessGuardProps) {
  const { user } = useAppSelector((state) => state.auth);

  if (!canAccessPath(path, user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
