import { useEffect, useMemo, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Alert, Avatar, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Image, Input, Popconfirm, Row, Select, Space, Upload, message } from 'antd';
import {
  CameraOutlined,
  DeleteOutlined,
  EyeOutlined,
  GoogleOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';
import dayjs, { type Dayjs } from 'dayjs';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { ROLE_LABELS, ROLES } from '@/shared/constants/roles';
import { isStudent } from '@/shared/constants/roleGroups';
import { setUser } from '@/features/auth/store/authSlice';
import { accountApi } from '../services/accountApi';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { normalizePhoneInput, optionalPhoneRule, PHONE_MAX_LENGTH } from '@/shared/utils/phoneInput';
import {
  DATE_DISPLAY_FORMAT,
  disableDateOfBirth,
} from '@/shared/utils/identityInput';

export function AccountSettingsPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [linkingSmartCa, setLinkingSmartCa] = useState(false);
  const [smartCaInput, setSmartCaInput] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [signaturePreviewOpen, setSignaturePreviewOpen] = useState(false);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const googleLoginEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

  const initialProfileValues = useMemo(
    () => ({
      fullName: user?.fullName,
      phone: user?.phone,
      address: user?.address,
      gender: user?.gender ?? undefined,
      dateOfBirth: user?.dateOfBirth ? dayjs(user.dateOfBirth) : null,
    }),
    [user],
  );

  useEffect(() => {
    profileForm.setFieldsValue(initialProfileValues);
  }, [initialProfileValues, profileForm]);

  useEffect(() => {
    setSmartCaInput(user?.smartCaUserId || '');
  }, [user?.smartCaUserId]);

  const isStaffAccount = Boolean(user?.role && user.role !== ROLES.STUDENT);

  const handleUpdateProfile = async (values: {
    fullName: string;
    phone?: string;
    address?: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Dayjs | null;
  }) => {
    try {
      setSavingProfile(true);
      const response = await accountApi.updateMe({
        fullName: values.fullName.trim(),
        phone: values.phone || undefined,
        address: values.address?.trim(),
        gender: values.gender ?? null,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : null,
      });
      dispatch(setUser(response.data.data));
      message.success('Đã cập nhật thông tin cá nhân');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (values: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    try {
      setChangingPassword(true);
      await accountApi.changePassword(values);
      message.success('Đổi mật khẩu thành công');
      passwordForm.resetFields();
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    try {
      setUploadingAvatar(true);
      const response = await accountApi.uploadAvatar(file);
      dispatch(setUser(response.data.data));
      message.success('Đã cập nhật ảnh đại diện');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingAvatar(false);
    }
    return false;
  };

  const handleDeleteAvatar = async () => {
    try {
      setUploadingAvatar(true);
      const response = await accountApi.deleteAvatar();
      dispatch(setUser(response.data.data));
      message.success('Đã xóa ảnh đại diện');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUploadSignature = async (file: File) => {
    try {
      setUploadingSignature(true);
      const response = await accountApi.uploadSignatureImage(file);
      dispatch(setUser(response.data.data));
      message.success('Đã cập nhật ảnh chữ ký');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingSignature(false);
    }
    return false;
  };

  const handleDeleteSignature = async () => {
    try {
      setUploadingSignature(true);
      const response = await accountApi.deleteSignatureImage();
      dispatch(setUser(response.data.data));
      message.success('Đã xóa ảnh chữ ký');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingSignature(false);
    }
  };

  const handleVerifySmartCa = async () => {
    try {
      setLinkingSmartCa(true);
      const response = await accountApi.verifySmartCa(smartCaInput.trim());
      dispatch(setUser(response.data.data));
      message.success('Đã tích hợp VNPT SmartCA vào tài khoản');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLinkingSmartCa(false);
    }
  };

  const handleUnlinkSmartCa = async () => {
    try {
      setLinkingSmartCa(true);
      const response = await accountApi.unlinkSmartCa();
      dispatch(setUser(response.data.data));
      setSmartCaInput('');
      message.success('Đã gỡ liên kết SmartCA');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLinkingSmartCa(false);
    }
  };

  const handleLinkGoogle = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      message.error('Không nhận được xác thực Google');
      return;
    }

    try {
      setLinkingGoogle(true);
      const response = await accountApi.linkGoogle({ idToken: credentialResponse.credential });
      dispatch(setUser(response.data.data));
      message.success('Đã liên kết Google thành công');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogle = async () => {
    try {
      setLinkingGoogle(true);
      const response = await accountApi.unlinkGoogle();
      dispatch(setUser(response.data.data));
      message.success('Đã hủy liên kết Google');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLinkingGoogle(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tài khoản & chữ ký số"
        subtitle="Thông tin cá nhân và cấu hình chữ ký điện tử"
      />

      <Card className="mb-4 border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl">
        <Descriptions title="Thông tin tài khoản" column={1} bordered size="small">
          <Descriptions.Item label="Họ và tên">{user?.fullName}</Descriptions.Item>
          <Descriptions.Item label="Email">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="Vai trò">
            {user?.role ? ROLE_LABELS[user.role] : '—'}
          </Descriptions.Item>
          <Descriptions.Item label="Số điện thoại">{user?.phone || '—'}</Descriptions.Item>
          {isStudent(user?.role) && (
            <Descriptions.Item label="Mã sinh viên">{user?.studentId || '—'}</Descriptions.Item>
          )}
          <Descriptions.Item label="Khoa">{user?.faculty || '—'}</Descriptions.Item>
          <Descriptions.Item label="Bộ môn / đơn vị">{user?.department || '—'}</Descriptions.Item>
          <Descriptions.Item label="Đăng nhập gần nhất">
            {user?.lastLoginAt ? dayjs(user.lastLoginAt).format('DD/MM/YYYY HH:mm') : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[16, 16]} className="mb-4">
        <Col xs={24} lg={8}>
          <Card title="Ảnh đại diện" className="border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl">
            <div className="flex flex-col items-center gap-4">
              <Avatar
                size={120}
                src={user?.avatar || undefined}
                icon={<UserOutlined />}
                className="bg-[var(--app-accent-soft)] text-[var(--app-accent)]"
              />

              <Space wrap className="justify-center">
                <ImgCrop
                  rotationSlider
                  aspect={1}
                  quality={1}
                  cropShape="round"
                  showGrid
                  modalTitle="Cắt ảnh đại diện"
                  modalOk="Lưu ảnh"
                  modalCancel="Hủy"
                >
                  <Upload
                    accept=".jpg,.jpeg,.png,.webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
                      if (!isImage) {
                        message.error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP');
                        return Upload.LIST_IGNORE;
                      }
                      const isUnderLimit = file.size / 1024 / 1024 < 3;
                      if (!isUnderLimit) {
                        message.error('Ảnh đại diện phải nhỏ hơn 3MB');
                        return Upload.LIST_IGNORE;
                      }
                      void handleUploadAvatar(file);
                      return false;
                    }}
                  >
                    <Button icon={<CameraOutlined />} loading={uploadingAvatar}>
                      {user?.avatar ? 'Đổi ảnh' : 'Tải ảnh'}
                    </Button>
                  </Upload>
                </ImgCrop>

                <Button
                  icon={<EyeOutlined />}
                  onClick={() => setPreviewOpen(true)}
                  disabled={!user?.avatar}
                >
                  Xem ảnh
                </Button>

                <Popconfirm
                  title="Xóa ảnh đại diện?"
                  description="Ảnh hiện tại sẽ bị xóa khỏi tài khoản."
                  onConfirm={handleDeleteAvatar}
                  okText="Xóa"
                  cancelText="Hủy"
                  disabled={!user?.avatar}
                >
                  <Button danger icon={<DeleteOutlined />} disabled={!user?.avatar} loading={uploadingAvatar}>
                    Xóa ảnh
                  </Button>
                </Popconfirm>
              </Space>

              <p className="text-xs text-[var(--app-text-muted)] text-center mb-0">
                Hỗ trợ JPG, PNG, WEBP. Dung lượng tối đa 3MB. Có thể cắt, xoay và chỉnh khung ảnh trước khi lưu.
              </p>
            </div>

            {user?.avatar && (
              <Image
                src={user.avatar}
                alt="Ảnh đại diện"
                preview={{
                  visible: previewOpen,
                  onVisibleChange: setPreviewOpen,
                }}
                className="hidden"
              />
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Cập nhật thông tin cá nhân" className="border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl">
            <Form
              form={profileForm}
              layout="vertical"
              initialValues={initialProfileValues}
              onFinish={handleUpdateProfile}
            >
              <Form.Item
                name="fullName"
                label="Họ và tên"
                rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
              >
                <Input placeholder="Nhập họ và tên" />
              </Form.Item>

              <Row gutter={12}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="phone"
                    label="Số điện thoại"
                    normalize={normalizePhoneInput}
                    rules={[optionalPhoneRule]}
                  >
                    <Input placeholder="0901234567" maxLength={PHONE_MAX_LENGTH} inputMode="numeric" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="gender" label="Giới tính">
                    <Select
                      allowClear
                      placeholder="Chọn giới tính"
                      options={[
                        { value: 'male', label: 'Nam' },
                        { value: 'female', label: 'Nữ' },
                        { value: 'other', label: 'Khác' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item name="dateOfBirth" label="Ngày sinh">
                <DatePicker
                  className="w-full"
                  format={DATE_DISPLAY_FORMAT}
                  disabledDate={disableDateOfBirth}
                />
              </Form.Item>

              <Form.Item name="address" label="Địa chỉ liên hệ">
                <Input.TextArea rows={3} placeholder="Nhập địa chỉ liên hệ" />
              </Form.Item>

              <Space>
                <Button type="primary" htmlType="submit" loading={savingProfile}>
                  Lưu thay đổi
                </Button>
                <Button onClick={() => profileForm.resetFields()}>Đặt lại</Button>
              </Space>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Đổi mật khẩu" className="border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl">
            <Form form={passwordForm} layout="vertical" onFinish={handleChangePassword}>
              <Form.Item
                name="currentPassword"
                label="Mật khẩu hiện tại"
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu hiện tại' }]}
              >
                <Input.Password placeholder="Nhập mật khẩu hiện tại" />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="Mật khẩu mới"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                  { min: 8, message: 'Mật khẩu mới phải có ít nhất 8 ký tự' },
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu mới" />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Xác nhận mật khẩu mới"
                dependencies={['newPassword']}
                rules={[
                  { required: true, message: 'Vui lòng xác nhận mật khẩu mới' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('newPassword') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Xác nhận mật khẩu không khớp'));
                    },
                  }),
                ]}
              >
                <Input.Password placeholder="Nhập lại mật khẩu mới" />
              </Form.Item>

              <Button type="primary" htmlType="submit" loading={changingPassword}>
                Cập nhật mật khẩu
              </Button>
            </Form>
          </Card>
        </Col>
      </Row>

      <Card title="Bảo mật & liên kết tài khoản" className="border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <GoogleOutlined className="text-lg text-red-500" />
            <span className="font-medium">Đăng nhập bằng Google</span>
          </div>
          <p className="text-[var(--app-text-muted)] text-sm mb-3">
            Chỉ cho phép đăng nhập Google khi email Google trùng đúng email tài khoản hệ thống và đã được liên kết trước.
          </p>
          <Alert
            type={user?.googleLinked ? 'success' : 'info'}
            showIcon
            className="mb-4"
            message={user?.googleLinked ? 'Tài khoản đã liên kết Google' : 'Tài khoản chưa liên kết Google'}
            description={
              user?.googleLinked
                ? `Google liên kết: ${user.googleEmail || user.email}`
                : 'Bạn cần liên kết Google tại đây trước khi có thể dùng nút Đăng nhập với Google ở màn hình đăng nhập.'
            }
          />

          {googleLoginEnabled ? (
            <Space direction="vertical" size="middle">
              {!user?.googleLinked ? (
                <GoogleLogin
                  onSuccess={handleLinkGoogle}
                  onError={() => message.error('Liên kết Google thất bại. Vui lòng thử lại.')}
                  text="continue_with"
                  shape="pill"
                />
              ) : (
                <Popconfirm
                  title="Hủy liên kết Google?"
                  description="Sau khi hủy, bạn sẽ không thể đăng nhập bằng Google cho đến khi liên kết lại."
                  onConfirm={handleUnlinkGoogle}
                  okText="Hủy liên kết"
                  cancelText="Đóng"
                >
                  <Button danger loading={linkingGoogle}>
                    Hủy liên kết Google
                  </Button>
                </Popconfirm>
              )}
            </Space>
          ) : (
            <Alert
              type="warning"
              showIcon
              message="Google Login chưa được cấu hình"
              description="Cần khai báo VITE_GOOGLE_CLIENT_ID ở frontend để hiện nút liên kết Google."
            />
          )}
        </div>

        <Divider />

        <div>
          <div className="flex items-center gap-2 mb-2">
            <SafetyCertificateOutlined className="text-lg text-[var(--app-accent)]" />
            <span className="font-medium">Ảnh chữ ký dùng khi ký duyệt PDF</span>
          </div>
          <p className="text-[var(--app-text-muted)] text-sm mb-3">
            Ảnh này sẽ được dán lên PDF khi bạn ký số (SmartCA / USB Token) ở bước duyệt yêu cầu chữ ký.
            Nên dùng ảnh chữ ký tay nền trong suốt (PNG) hoặc nền trắng.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-start mb-3">
            <div className="w-48 h-24 border border-dashed border-[var(--app-border)] rounded-lg flex items-center justify-center bg-[var(--app-bg)] overflow-hidden">
              {user?.signatureImageUrl ? (
                <img
                  src={user.signatureImageUrl}
                  alt="Ảnh chữ ký"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <span className="text-xs text-[var(--app-text-muted)]">Chưa có ảnh chữ ký</span>
              )}
            </div>

            <Space wrap>
              <Upload
                accept="image/png,image/jpeg,image/webp"
                showUploadList={false}
                beforeUpload={(file) => {
                  if (file.size > 3 * 1024 * 1024) {
                    message.error('Ảnh chữ ký tối đa 3MB');
                    return Upload.LIST_IGNORE;
                  }
                  void handleUploadSignature(file);
                  return false;
                }}
              >
                <Button icon={<CameraOutlined />} loading={uploadingSignature}>
                  {user?.signatureImageUrl ? 'Đổi ảnh chữ ký' : 'Tải ảnh chữ ký'}
                </Button>
              </Upload>

              <Button
                icon={<EyeOutlined />}
                onClick={() => setSignaturePreviewOpen(true)}
                disabled={!user?.signatureImageUrl}
              >
                Xem trước
              </Button>

              <Popconfirm
                title="Xóa ảnh chữ ký?"
                description="Bạn sẽ không ký duyệt được các bước yêu cầu chữ ký số cho đến khi tải lại ảnh."
                onConfirm={handleDeleteSignature}
                okText="Xóa"
                cancelText="Hủy"
                disabled={!user?.signatureImageUrl}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!user?.signatureImageUrl}
                  loading={uploadingSignature}
                >
                  Xóa
                </Button>
              </Popconfirm>
            </Space>
          </div>

          {user?.signatureImageUrl && (
            <Image
              src={user.signatureImageUrl}
              alt="Ảnh chữ ký"
              preview={{
                visible: signaturePreviewOpen,
                onVisibleChange: setSignaturePreviewOpen,
              }}
              className="hidden"
            />
          )}

          <Alert
            type={user?.signatureImageUrl ? 'success' : 'warning'}
            showIcon
            message={
              user?.signatureImageUrl
                ? 'Đã sẵn sàng ký số khi duyệt hồ sơ'
                : 'Cần tải ảnh chữ ký trước khi ký duyệt bước yêu cầu chữ ký số'
            }
            description="Luồng ký: chọn SmartCA hoặc USB Token → xác thực → hệ thống dán ảnh chữ ký lên PDF và lưu metadata chứng thư."
          />
        </div>

        {isStaffAccount && (
          <>
            <Divider />
            <div>
              <div className="flex items-center gap-2 mb-3">
                <SafetyCertificateOutlined className="text-lg text-[var(--app-accent)]" />
                <span className="font-medium">Tích hợp VNPT SmartCA</span>
              </div>

              <Space.Compact style={{ width: '100%', maxWidth: 420 }} className="mb-3">
                <Input
                  placeholder="CCCD hoặc MST thuê bao SmartCA"
                  value={smartCaInput}
                  onChange={(e) => setSmartCaInput(e.target.value.replace(/[^\d]/g, '').slice(0, 13))}
                  maxLength={13}
                  disabled={linkingSmartCa}
                />
                <Button type="primary" loading={linkingSmartCa} onClick={() => void handleVerifySmartCa()}>
                  Kiểm tra &amp; lưu
                </Button>
              </Space.Compact>

              {user?.smartCaUserId ? (
                <Alert
                  type="success"
                  showIcon
                  className="mb-3"
                  message={`Đã gắn thuê bao: ${user.smartCaUserId}`}
                  description={
                    <div className="space-y-1">
                      {user.smartCaCertSubject ? (
                        <div>Chứng thư: {user.smartCaCertSubject}</div>
                      ) : null}
                      {user.smartCaVerifiedAt ? (
                        <div>
                          Xác minh:{' '}
                          {dayjs(user.smartCaVerifiedAt).format('DD/MM/YYYY HH:mm')}
                        </div>
                      ) : null}
                    </div>
                  }
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  className="mb-3"
                  message="Chưa tích hợp SmartCA"
                  description="Nhập CCCD/MST thuê bao đã kích hoạt trên app VNPT SmartCA rồi bấm Kiểm tra &amp; lưu."
                />
              )}

              {user?.smartCaUserId ? (
                <Popconfirm
                  title="Gỡ liên kết SmartCA?"
                  description="Bạn sẽ cần gắn lại trước khi ký số bằng VNPT SmartCA."
                  onConfirm={() => void handleUnlinkSmartCa()}
                  okText="Gỡ"
                  cancelText="Hủy"
                >
                  <Button danger loading={linkingSmartCa}>
                    Gỡ liên kết SmartCA
                  </Button>
                </Popconfirm>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
