import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';

const { Content } = Layout;

export function AuthLayout() {
  return (
    <Layout className="min-h-screen bg-[var(--app-bg)] transition-colors duration-300">
      <Content className="w-full min-h-screen">
        <Outlet />
      </Content>
    </Layout>
  );
}
