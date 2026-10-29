import { useRef } from 'react';
import { Drawer, FloatButton, Layout } from 'antd';
import { VerticalAlignTopOutlined } from '@ant-design/icons';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { SidebarNav } from './SidebarNav';
import { Header } from './Header';
import { LayoutProvider, useLayout } from './LayoutContext';
import { useBreakpoint } from '@/shared/hooks/useBreakpoint';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { isAdmin } from '@/shared/constants/roleGroups';
import { AdminChatbotWidget } from '@/features/admin-chatbot';

const { Content } = Layout;

function MainLayoutContent() {
  const { isMobile } = useBreakpoint();
  const { mobileMenuOpen, closeMobileMenu } = useLayout();
  const contentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const showAdminChat = isAdmin(user?.role);

  const getScrollTarget = () => {
    const el = contentRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    return window;
  };

  return (
    <Layout className="admin-shell h-screen max-h-screen overflow-hidden bg-[var(--app-bg)] dark:bg-[var(--app-bg)] transition-colors duration-250">
      {!isMobile && <Sidebar />}

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={closeMobileMenu}
          width={280}
          closable={false}
          styles={{ body: { padding: 0 } }}
          className="sidebar-drawer"
        >
          <SidebarNav onItemClick={closeMobileMenu} className="min-h-full" />
        </Drawer>
      )}

      <Layout className="bg-transparent min-w-0 min-h-0 h-full overflow-hidden flex flex-col">
        <Header />
        <Content
          ref={contentRef}
          id="admin-main-scroll"
          className="admin-content-panel m-2 sm:m-3 lg:m-4 p-3 sm:p-4 lg:p-5 overflow-x-hidden overflow-y-auto flex-1 min-h-0 min-w-0 transition-colors duration-250"
        >
          <Outlet />
        </Content>
      </Layout>

      {showAdminChat && <AdminChatbotWidget />}

      <FloatButton.BackTop
        target={getScrollTarget}
        visibilityHeight={240}
        type="primary"
        icon={<VerticalAlignTopOutlined />}
        tooltip="Cuộn lên đầu trang"
      />
    </Layout>
  );
}

export function MainLayout() {
  return (
    <LayoutProvider>
      <MainLayoutContent />
    </LayoutProvider>
  );
}
