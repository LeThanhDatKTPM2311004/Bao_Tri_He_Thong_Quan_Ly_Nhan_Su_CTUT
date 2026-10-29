import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Alert, Spin } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ui/ThemeToggle';
import { authApi } from '../services/authApi';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { FORGOT_PASSWORD_EMAIL_KEY } from '../constants/authStorage';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setVerifying(false);
        setTokenValid(false);
        setErrorMessage('Liên kết đặt lại mật khẩu không hợp lệ.');
        return;
      }

      try {
        const response = await authApi.verifyResetToken(token);
        setAccountEmail((response.data.data as any).accountEmail ?? null);
        setTokenValid(true);
      } catch (err) {
        setErrorMessage(getErrorMessage(err));
        setTokenValid(false);
      } finally {
        setVerifying(false);
      }
    };

    verify();
  }, [token]);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await authApi.resetPassword({ token, password: values.password });
      sessionStorage.removeItem(FORGOT_PASSWORD_EMAIL_KEY);
      setSuccess(true);
      setTimeout(() => navigate('/auth/login'), 2500);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--app-bg)] transition-colors duration-300">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border border-[var(--app-border)] shadow-sm rounded-2xl bg-[var(--app-surface)]">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-[var(--app-text)]">Đặt lại mật khẩu</h2>
          <p className="text-xs text-[var(--app-text-muted)] mt-1">
            Nhập mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {verifying ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <Spin size="large" />
            <span className="text-sm text-[var(--app-text-muted)]">Đang xác minh liên kết...</span>
          </div>
        ) : (
          <>
            {errorMessage && !success && (
              <Alert
                message={errorMessage}
                type="error"
                showIcon
                closable
                className="mb-4 text-xs"
                onClose={() => setErrorMessage(null)}
              />
            )}

            {success ? (
              <Alert
                message="Đặt lại mật khẩu thành công"
                description="Đang chuyển về trang đăng nhập..."
                type="success"
                showIcon
              />
            ) : tokenValid ? (
              <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
                {accountEmail && (
                  <Alert
                    message={`Mật khẩu mới sẽ được lưu cho tài khoản: ${accountEmail}`}
                    type="info"
                    showIcon
                    className="mb-4 text-xs"
                  />
                )}
                <Form.Item
                  name="password"
                  label={<span className="text-[var(--app-text-muted)] font-medium">Mật khẩu mới</span>}
                  rules={[
                    { required: true, message: 'Vui lòng nhập mật khẩu' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-[var(--app-text-muted)] mr-2" />}
                    placeholder="••••••••"
                    className="h-11 rounded-lg"
                  />
                </Form.Item>

                <Form.Item
                  name="confirmPassword"
                  label={<span className="text-[var(--app-text-muted)] font-medium">Xác nhận mật khẩu</span>}
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Vui lòng xác nhận mật khẩu' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error('Mật khẩu xác nhận không khớp'));
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="text-[var(--app-text-muted)] mr-2" />}
                    placeholder="••••••••"
                    className="h-11 rounded-lg"
                  />
                </Form.Item>

                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="h-11 rounded-lg font-semibold"
                >
                  Cập nhật mật khẩu
                </Button>
              </Form>
            ) : null}
          </>
        )}

        <div className="mt-6 text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--app-accent)] hover:text-[var(--app-accent-hover)]"
          >
            <ArrowLeftOutlined />
            Quay lại đăng nhập
          </Link>
        </div>
      </Card>
    </div>
  );
}
