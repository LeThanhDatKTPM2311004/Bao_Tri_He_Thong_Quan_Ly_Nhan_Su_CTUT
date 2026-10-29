import { useEffect, useMemo } from 'react';
import { Spin } from 'antd';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { initializeAuth } from '@/features/auth/store/authSlice';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const dispatch = useAppDispatch();
  const { isInitializing } = useAppSelector((state) => state.auth);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  const loadingScreen = useMemo(
    () => (
      <div className="min-h-screen flex items-center justify-center bg-[#eef2f7] dark:bg-slate-950 transition-colors">
        <Spin size="large" tip="Đang tải phiên đăng nhập..." />
      </div>
    ),
    [],
  );

  if (isInitializing) return loadingScreen;

  return <>{children}</>;
}
