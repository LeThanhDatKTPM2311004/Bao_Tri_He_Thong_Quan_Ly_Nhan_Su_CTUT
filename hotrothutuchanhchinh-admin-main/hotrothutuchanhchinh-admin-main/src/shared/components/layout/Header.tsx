import { Layout, Avatar, Dropdown, Space, Tag, Button } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  KeyOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { logoutAsync } from '@/features/auth/store/authSlice';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { ThemeToggle } from '@/shared/components/ui/ThemeToggle';
import { ROLE_LABELS } from '@/shared/constants/roles';
import { useLayout } from './LayoutContext';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { HeaderGlobalSearch } from './HeaderGlobalSearch';

const { Header: AntHeader } = Layout;

export function Header() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { toggleMobileMenu } = useLayout();
  const { isMobile } = useBreakpoint();

  const handleLogout = async () => {
    await dispatch(logoutAsync());
    navigate('/auth/login');
  };

  const profilePath = '/account';

  const profileMenuItems = [
    {
      key: 'profile-info',
      label: (
        <div className="px-2 py-1.5 min-w-[200px] leading-tight">
          <div className="font-semibold text-[var(--app-text)] leading-tight">{user?.fullName ?? 'Họ và tên'}</div>
          <div className="text-xs text-[var(--app-text-muted)] mt-0.5 leading-tight">{user?.email ?? 'email@tthc.local'}</div>
        </div>
      ),
    },
    { type: 'divider' as const },
    { key: 'profile', icon: <UserOutlined />, label: 'Thông tin cá nhân', onClick: () => navigate(profilePath) },
    { key: 'security', icon: <KeyOutlined />, label: 'Bảo mật & Chữ ký số', onClick: () => navigate(profilePath) },
    { key: 'settings', icon: <SettingOutlined />, label: 'Cài đặt tài khoản', onClick: () => navigate(profilePath) },
    { type: 'divider' as const },
    {
      key: 'logout',
      icon: <LogoutOutlined className="text-red-500" />,
      label: <span className="text-red-500 font-semibold">Đăng xuất</span>,
      onClick: handleLogout,
    },
  ];

  return (
    <AntHeader className="bg-[var(--app-surface)] px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-2 sm:gap-4 border-b border-[var(--app-border)] h-14 lg:h-16 transition-colors duration-250 sticky top-0 z-30 !leading-none">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {isMobile && (
          <Button
            type="text"
            icon={<MenuOutlined className="text-lg" />}
            onClick={toggleMobileMenu}
            className="shrink-0 !w-10 !h-10 flex items-center justify-center"
            aria-label="Mở menu điều hướng"
          />
        )}

        <div className="flex-1 max-w-md min-w-0">
          <HeaderGlobalSearch />
        </div>
      </div>

      <Space size={isMobile ? 'small' : 'middle'} className="shrink-0">
        {user?.role && (
          <Tag className="rounded-md px-2 sm:px-2.5 py-0.5 text-[10px] sm:text-[11px] font-semibold border border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] uppercase tracking-wide hidden sm:inline-block max-w-[140px] lg:max-w-none truncate m-0">
            {ROLE_LABELS[user.role]}
          </Tag>
        )}

        <ThemeToggle size="sm" />

        <div className="flex items-center justify-center rounded-lg hover:bg-[var(--app-bg)] transition-colors">
          <NotificationBell />
        </div>

        <Dropdown menu={{ items: profileMenuItems }} placement="bottomRight" trigger={['click']}>
          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer group bg-transparent border-0 p-0 m-0 h-auto"
          >
            <Avatar
              src={user?.avatar || undefined}
              icon={<UserOutlined />}
              size={36}
              className="border border-[var(--app-border)] bg-[var(--app-accent-soft)] text-[var(--app-accent)] shrink-0"
            />
            <div className="hidden md:flex flex-col justify-center gap-0.5 leading-tight text-left max-w-[140px] lg:max-w-[200px] min-h-0 self-center">
              <span className="block text-xs font-semibold leading-tight text-[var(--app-text)] group-hover:text-[var(--app-accent)] transition-colors truncate">
                {user?.fullName ?? 'User'}
              </span>
              <span className="block text-[11px] leading-tight text-[var(--app-text-muted)] truncate">
                {user?.email ?? 'email@tthc.local'}
              </span>
            </div>
          </button>
        </Dropdown>
      </Space>
    </AntHeader>
  );
}
