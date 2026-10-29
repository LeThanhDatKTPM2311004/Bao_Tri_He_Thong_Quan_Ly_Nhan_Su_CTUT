import { useEffect, useState } from 'react';
import { Card, Form, Input, Button, Alert } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '@/shared/components/ui/ThemeToggle';
import { authApi } from '../services/authApi';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { FORGOT_PASSWORD_EMAIL_KEY } from '../constants/authStorage';

export function ForgotPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const accountEmail =
    (location.state as { email?: string } | null)?.email?.trim()
    ?? sessionStorage.getItem(FORGOT_PASSWORD_EMAIL_KEY)?.trim()
    ?? '';

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accountEmail) {
      navigate('/auth/login', {
        replace: true,
        state: {
          message: 'Vui lòng nhập địa chỉ email ở form đăng nhập trước khi quên mật khẩu.',
        },
      });
    }
  }, [accountEmail, navigate]);

  const handleSubmit = async (values: { recipientEmail: string }) => {
    if (!accountEmail) return;

    setLoading(true);
    setErrorMessage(null);
    try {
      sessionStorage.setItem(FORGOT_PASSWORD_EMAIL_KEY, accountEmail);
      await authApi.forgotPassword({
        accountEmail,
        recipientEmail: values.recipientEmail.trim(),
      });
      setRecipientEmail(values.recipientEmail.trim());
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!accountEmail) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--app-bg)] transition-colors duration-300">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border border-[var(--app-border)] shadow-sm rounded-2xl bg-[var(--app-surface)]">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-[var(--app-text)]">Quên mật khẩu</h2>
          <p className="text-xs text-[var(--app-text-muted)] mt-1">
            Nhập email để nhận liên kết đặt lại. Mật khẩu sẽ được cập nhật cho tài khoản đã nhập ở màn hình đăng nhập.
          </p>
        </div>

        {errorMessage && (
          <Alert
            message={errorMessage}
            type="error"
            showIcon
            closable
            className="mb-4 text-xs"
            onClose={() => setErrorMessage(null)}
          />
        )}

        {submitted ? (
          <Alert
            message="Yêu cầu đã được gửi"
            description={`Liên kết đặt lại mật khẩu đã được gửi đến ${recipientEmail}. Sau khi mở link và cập nhật mật khẩu, tài khoản ${accountEmail} sẽ được đổi mật khẩu.`}
            type="success"
            showIcon
            className="mb-4"
          />
        ) : (
          <Form form={form} layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <div className="mb-4">
              <label className="block text-[var(--app-text-muted)] font-medium text-sm mb-1.5">
                Tài khoản cần đặt lại mật khẩu
              </label>
              <Input
                value={accountEmail}
                disabled
                prefix={<MailOutlined className="text-[var(--app-text-muted)] mr-2" />}
                className="h-11 rounded-lg"
              />
            </div>

            <Form.Item
              name="recipientEmail"
              label={<span className="text-[var(--app-text-muted)] font-medium">Email nhận liên kết</span>}
              rules={[
                { required: true, message: 'Vui lòng nhập email nhận liên kết' },
                { type: 'email', message: 'Email không đúng định dạng' },
              ]}
            >
              <Input
                prefix={<MailOutlined className="text-[var(--app-text-muted)] mr-2" />}
                placeholder="gmail@gmail.com"
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
              Gửi liên kết đặt lại
            </Button>
          </Form>
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
