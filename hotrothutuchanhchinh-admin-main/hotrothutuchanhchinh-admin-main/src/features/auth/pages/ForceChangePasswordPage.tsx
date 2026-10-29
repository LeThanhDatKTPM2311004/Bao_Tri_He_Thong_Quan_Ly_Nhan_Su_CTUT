import { useState } from 'react';
import { Alert, Button, Card, Form, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { accountApi } from '@/features/account/services/accountApi';
import { logoutAsync, setUser } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';

export function ForceChangePasswordPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await accountApi.changePassword(values);
      if (user) {
        dispatch(setUser({ ...user, mustChangePassword: false }));
      }
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--app-bg)]">
      <Card className="w-full max-w-md border border-[var(--app-border)] shadow-sm rounded-2xl">
        <h2 className="text-xl font-semibold text-[var(--app-text)] mb-1">Đổi mật khẩu lần đầu</h2>
        <p className="text-sm text-[var(--app-text-muted)] mb-4">
          Tài khoản đang dùng mật khẩu được cấp sẵn. Hãy đặt mật khẩu mới trước khi tiếp tục.
        </p>
        {errorMessage && <Alert type="error" showIcon message={errorMessage} className="mb-4" />}
        <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item
            name="currentPassword"
            label="Mật khẩu hiện tại"
            rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự' },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Xác nhận mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Xác nhận mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                  return Promise.reject(new Error('Xác nhận mật khẩu không khớp'));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            Lưu mật khẩu mới
          </Button>
          <Button
            type="link"
            block
            className="mt-2"
            onClick={() => {
              void dispatch(logoutAsync()).then(() => navigate('/auth/login', { replace: true }));
            }}
          >
            Đăng xuất
          </Button>
        </Form>
      </Card>
    </div>
  );
};
