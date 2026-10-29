import { Menu } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '@/store/hooks';
import { useTheme } from '@/app/providers/ThemeProvider';
import { getPortalSubtitle, getSidebarMenuItems } from '@/shared/constants/menuConfig';

const CTUT_LOGO_SRC = '/assets/images/logo-truong-removebg-preview.png';

interface SidebarNavProps {
  onItemClick?: () => void;
  className?: string;
}

export function SidebarNav({ onItemClick, className }: SidebarNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAppSelector((state) => state.auth);
  const { isDark } = useTheme();

  const menuItems = getSidebarMenuItems(user?.role);

  return (
    <div className={`flex flex-col h-full min-h-0 bg-[var(--app-surface)] ${className ?? ''}`}>
      <div className="h-16 sm:h-[4.5rem] flex items-center gap-3 px-4 sm:px-5 border-b border-[var(--app-border)] shrink-0">
        <img
          src={CTUT_LOGO_SRC}
          alt="Logo CTUT"
          className="w-10 h-10 object-contain shrink-0"
        />
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-[var(--app-text)] tracking-tight leading-tight truncate">
            CTUT e-Portal
          </h1>
          <span className="text-[11px] text-[var(--app-text-muted)] font-medium tracking-wide block truncate">
            {getPortalSubtitle(user?.role)}
          </span>
        </div>
      </div>

      <Menu
        mode="inline"
        theme={isDark ? 'dark' : 'light'}
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => {
          navigate(key);
          onItemClick?.();
        }}
        className="border-none pt-3 px-2 text-[13px] font-medium bg-transparent flex-1 min-h-0 overflow-y-auto"
      />
    </div>
  );
}
