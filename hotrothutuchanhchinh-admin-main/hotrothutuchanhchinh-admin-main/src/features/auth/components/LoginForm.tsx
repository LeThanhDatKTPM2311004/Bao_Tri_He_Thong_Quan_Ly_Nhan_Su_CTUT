import { useState, useEffect } from 'react';
import { Form, Input, Button, Checkbox, Alert, Divider, message } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  LockOutlined,
  MailOutlined,
  GoogleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { login, loginWithGoogle } from '../store/authSlice';
import { standardEmailRule } from '@/shared/utils/ctutEmail';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { stripAllWhitespace } from '@/shared/utils/formInput';
import { FORGOT_PASSWORD_EMAIL_KEY } from '../constants/authStorage';
import { AUTH_INPUT_MAX_LENGTH, authInputMaxLengthRule } from '../constants/authValidation';

const CTUT_LOGO_SRC = '/assets/images/logo-truong-removebg-preview.png';

export function LoginForm() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated, isInitializing, user } = useAppSelector(
    (state) => state.auth,
  );

  const [form] = Form.useForm();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const googleLoginEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate(user?.mustChangePassword ? '/auth/change-password' : '/dashboard', { replace: true });
    }
  }, [isAuthenticated, isInitializing, navigate, user?.mustChangePassword]);

  useEffect(() => {
    setErrorMessage(error || null);
  }, [error]);

  useEffect(() => {
    const msg = (location.state as { message?: string } | null)?.message;
    if (msg) {
      setErrorMessage(msg);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const handleForgotPasswordClick = async () => {
    setErrorMessage(null);
    try {
      await form.validateFields(['email']);
      const email = String(form.getFieldValue('email')).trim();
      sessionStorage.setItem(FORGOT_PASSWORD_EMAIL_KEY, email);
      navigate('/auth/forgot-password', { state: { email } });
    } catch {
      setErrorMessage('Vui lòng nhập địa chỉ email ở form đăng nhập trước khi quên mật khẩu.');
    }
  };

  const handleLoginSubmit = async (values: { email: string; password: string; remember?: boolean }) => {
    setErrorMessage(null);
    try {
      await dispatch(
        login({
          email: stripAllWhitespace(values.email) as string,
          password: stripAllWhitespace(values.password) as string,
          rememberMe: values.remember ?? false,
        }),
      ).unwrap();
    } catch (err: unknown) {
      setErrorMessage(typeof err === 'string' ? err : getErrorMessage(err));
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    setErrorMessage(null);
    if (!credentialResponse.credential) {
      setErrorMessage('Không nhận được xác thực Google. Vui lòng thử lại.');
      return;
    }

    try {
      const authData = await dispatch(
        loginWithGoogle({
          idToken: credentialResponse.credential,
          rememberMe: form.getFieldValue('remember') ?? false,
        }),
      ).unwrap();
      message.success(
        authData.linkedGoogleNow
          ? 'Đã liên kết tài khoản với Google và đăng nhập thành công'
          : 'Đăng nhập Google thành công',
      );
      navigate(authData.user?.mustChangePassword ? '/auth/change-password' : '/dashboard');
    } catch (err: unknown) {
      setErrorMessage(typeof err === 'string' ? err : getErrorMessage(err));
    }
  };

  return (
    <div className="w-full max-w-md px-1 sm:px-2 py-4 sm:py-6">
      <div className="text-center mb-8 lg:hidden">
        <img
          src={CTUT_LOGO_SRC}
          alt="Logo CTUT"
          className="inline-block w-14 h-14 object-contain mb-3"
        />
        <h1 className="text-lg font-semibold text-[var(--app-text)] tracking-tight">
          Trường Đại học Kỹ thuật — Công nghệ Cần Thơ
        </h1>
        <p className="text-xs text-[var(--app-text-muted)] font-medium mt-1">
          Hệ thống thủ tục hành chính điện tử
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-[var(--app-text)] tracking-tight">Đăng nhập</h2>
        <p className="text-sm text-[var(--app-text-muted)] mt-1">
          Dùng tài khoản được cấp từ hệ thống
        </p>
      </div>

      {errorMessage && (
        <Alert
          message={errorMessage}
          type="error"
          showIcon
          closable
          className="mb-4 text-xs font-medium rounded-lg"
          onClose={() => setErrorMessage(null)}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleLoginSubmit}
        requiredMark={false}
        className="pt-1"
      >
        <Form.Item
          name="email"
          label={<span className="text-[var(--app-text-muted)] font-medium text-xs">Địa chỉ Email</span>}
          normalize={stripAllWhitespace}
          rules={[
            { required: true, message: 'Vui lòng nhập Email' },
            { type: 'email', message: 'Email không đúng định dạng' },
            standardEmailRule,
            authInputMaxLengthRule,
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-slate-400 mr-2" />}
            placeholder="vidu@gmail.com"
            maxLength={AUTH_INPUT_MAX_LENGTH}
            className="h-11 rounded-lg"
          />
        </Form.Item>

        <Form.Item
          name="password"
          label={<span className="text-[var(--app-text-muted)] font-medium text-xs">Mật khẩu</span>}
          normalize={stripAllWhitespace}
          rules={[
            { required: true, message: 'Vui lòng nhập mật khẩu' },
            { min: 6, message: 'Mật khẩu phải chứa ít nhất 6 ký tự' },
            authInputMaxLengthRule,
          ]}
        >
          <Input.Password
            prefix={<LockOutlined className="text-slate-400 mr-2" />}
            placeholder="••••••••"
            maxLength={AUTH_INPUT_MAX_LENGTH}
            iconRender={(visible) => (visible ? <EyeOutlined /> : <EyeInvisibleOutlined />)}
            className="h-11 rounded-lg"
          />
        </Form.Item>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox className="text-xs text-[var(--app-text-muted)] font-medium">
              Duy trì đăng nhập
            </Checkbox>
          </Form.Item>
          <button
            type="button"
            onClick={handleForgotPasswordClick}
            className="text-xs font-semibold text-[var(--app-accent)] hover:text-[var(--app-accent-hover)] bg-transparent border-0 p-0 cursor-pointer"
          >
            Quên mật khẩu?
          </button>
        </div>

        <Button
          type="primary"
          htmlType="submit"
          loading={isLoading}
          block
          className="h-11 rounded-lg font-semibold text-sm"
        >
          Đăng nhập
        </Button>

        <Divider className="my-5 text-[var(--app-text-muted)] text-xs">hoặc</Divider>

        {googleLoginEnabled ? (
          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setErrorMessage('Đăng nhập Google thất bại. Vui lòng thử lại.')}
              type="standard"
              theme="outline"
              size="medium"
              shape="pill"
              text="signin_with"
              logo_alignment="left"
              width={280}
            />
          </div>
        ) : (
          <Alert
            className="mt-1"
            type="info"
            showIcon
            icon={<GoogleOutlined />}
            message="Đăng nhập Google chưa được cấu hình"
            description="Cần khai báo VITE_GOOGLE_CLIENT_ID để bật nút đăng nhập Google."
          />
        )}
      </Form>

      <div className="text-center mt-8 text-xs font-medium text-[var(--app-text-muted)]">
        <a href="#support" className="hover:text-[var(--app-accent)]">
          Hỗ trợ kỹ thuật
        </a>
      </div>
    </div>
  );
}
