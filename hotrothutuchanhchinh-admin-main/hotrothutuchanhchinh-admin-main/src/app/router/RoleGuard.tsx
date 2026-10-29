import { Navigate } from 'react-router-dom';
import { ROLES } from '@/shared/constants/roles';
import { useAppSelector } from '@/store/hooks';

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: string;
}

export function RoleGuard({
  allowedRoles,
  children,
  fallback = '/dashboard',
}: RoleGuardProps) {
  const { user } = useAppSelector((state) => state.auth);
  const role = user?.role ?? '';

  if (!allowedRoles.includes(role)) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

export { ROLES };
