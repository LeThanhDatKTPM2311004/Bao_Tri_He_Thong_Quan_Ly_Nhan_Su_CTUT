import { useAppSelector } from '@/store/hooks';

export function usePermission(requiredPermissions: string[]): boolean {
  const { user } = useAppSelector((state) => state.auth);
  if (!user) return false;
  if (user.role === 'admin') return true;
  const userPermissions = user.permissions ?? [];
  return requiredPermissions.every((p) => userPermissions.includes(p));
}
