import { Layout } from 'antd';
import { useTheme } from '@/app/providers/ThemeProvider';
import { SidebarNav } from './SidebarNav';

const { Sider } = Layout;

export function Sidebar() {
  const { isDark } = useTheme();

  return (
    <Sider
      theme={isDark ? 'dark' : 'light'}
      width={260}
      breakpoint="lg"
      collapsedWidth={0}
      className="admin-sidebar !hidden lg:!block border-r border-[var(--app-border)] transition-colors duration-250"
    >
      <SidebarNav className="h-full min-h-0" />
    </Sider>
  );
}
