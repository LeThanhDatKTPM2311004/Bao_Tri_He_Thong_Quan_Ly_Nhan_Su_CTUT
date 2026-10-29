import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Radio, Space, Spin, Typography, Upload, message } from 'antd';
import {
  EditOutlined,
  SafetyCertificateOutlined,
  UploadOutlined,
  UsbOutlined,
} from '@ant-design/icons';
import { accountApi } from '@/features/account/services/accountApi';
import { setUser } from '@/features/auth/store/authSlice';
import { signaturesApi, type SignatureProvider } from '@/features/signatures/services/signaturesApi';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { restrictDigitsInput } from '@/shared/utils/formInput';
import type { PendingTask, SignaturePlacement, StaffProcessMode } from '../types/workflows.types';
import { HandwrittenSignaturePad } from './HandwrittenSignaturePad';
import { SignaturePlacer } from './SignaturePlacer';

export interface SignApprovePayload {
  action: StaffProcessMode;
  comment?: string;
  signature?: {
    provider: string;
    pin?: string;
    smartCaUsername?: string;
    stampImageUrl?: string;
    placement?: SignaturePlacement;
  };
}

interface SignApproveModalProps {
  open: boolean;
  task: PendingTask | null;
  mode: StaffProcessMode;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (payload: SignApprovePayload) => void;
}

export function SignApproveModal({
  open,
  task,
  mode,
  loading,
  onCancel,
  onConfirm,
}: SignApproveModalProps) {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [form] = Form.useForm();
  const [providers, setProviders] = useState<SignatureProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [smartCaPending, setSmartCaPending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [handDrawnDataUrl, setHandDrawnDataUrl] = useState<string | null>(null);
  const [handSource, setHandSource] = useState<'draw' | 'saved'>('draw');
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [localSignatureUrl, setLocalSignatureUrl] = useState('');
  const [placement, setPlacement] = useState<SignaturePlacement | null>(null);

  const isDigitalSign = mode === 'sign';
  const isHandwritten = mode === 'handwritten';
  const requiresSignature = isDigitalSign || isHandwritten;
  const provider = Form.useWatch('provider', form);
  const savedSignatureUrl = localSignatureUrl || user?.signatureImageUrl || '';

  const placementPreviewImage = isHandwritten
    ? handSource === 'saved'
      ? savedSignatureUrl
      : handDrawnDataUrl || ''
    : savedSignatureUrl;

  const placementBoxLabel = isHandwritten ? 'CHỮ KÝ TAY' : 'CHỮ KÝ SỐ';

  const handlePlacementChange = useCallback(
    (next: SignaturePlacement) => setPlacement(next),
    [],
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setSmartCaPending(false);
    setCountdown(0);
    setHandDrawnDataUrl(null);
    setLocalSignatureUrl('');
    setPlacement(null);
    setHandSource(user?.signatureImageUrl ? 'saved' : 'draw');
    form.setFieldsValue({ provider: 'smartca_vnpt' });

    if (!isDigitalSign) return;

    setLoadingProviders(true);
    signaturesApi
      .getProviders()
      .then((res) => {
        const list = (res.data.data || []).filter((item) => item.value !== 'handwritten');
        setProviders(list);
        if (user?.smartCaUserId) {
          form.setFieldsValue({ smartCaUsername: user.smartCaUserId });
        }
      })
      .catch(() => {
        setProviders([
          { value: 'smartca_vnpt', label: 'VNPT SmartCA', mode: 'remote' },
          { value: 'smartca_viettel', label: 'Viettel SmartCA', mode: 'remote' },
          { value: 'usb_token', label: 'USB Token', mode: 'local' },
        ]);
        if (user?.smartCaUserId) {
          form.setFieldsValue({ smartCaUsername: user.smartCaUserId });
        }
      })
      .finally(() => setLoadingProviders(false));
  }, [open, isDigitalSign, form, user?.signatureImageUrl, user?.smartCaUserId]);

  const handleUploadSignature = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      message.error('Vui lòng chọn file ảnh (PNG/JPG)');
      return false;
    }
    if (file.size > 3 * 1024 * 1024) {
      message.error('Ảnh chữ ký tối đa 3MB');
      return false;
    }

    try {
      setUploadingSignature(true);
      const response = await accountApi.uploadSignatureImage(file);
      const updatedUser = response.data.data;
      dispatch(setUser(updatedUser));
      setLocalSignatureUrl(updatedUser.signatureImageUrl || '');
      if (isHandwritten) setHandSource('saved');
      form.setFields([{ name: 'signatureImage', errors: [] }]);
      message.success(
        isDigitalSign
          ? 'Đã tải ảnh chữ ký — có thể dùng để ký số'
          : 'Đã tải ảnh chữ ký — có thể dùng để ký tay',
      );
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingSignature(false);
    }
    return false;
  };

  useEffect(() => {
    if (!loading || !isDigitalSign) {
      setSmartCaPending(false);
      setCountdown(0);
      return undefined;
    }
    setSmartCaPending(true);
    setCountdown(120);
    const timer = window.setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading, isDigitalSign]);

  const title = useMemo(() => {
    if (isHandwritten) return 'Ký tay & duyệt hồ sơ';
    if (isDigitalSign) return 'Ký số & duyệt hồ sơ';
    return 'Xác nhận duyệt hồ sơ';
  }, [isDigitalSign, isHandwritten]);

  const handleOk = async () => {
    const values = await form.validateFields();

    if (!requiresSignature) {
      onConfirm({ action: 'approve', comment: values.comment || undefined });
      return;
    }

    if (isHandwritten) {
      const stampImageUrl =
        handSource === 'saved' && savedSignatureUrl ? savedSignatureUrl : handDrawnDataUrl;
      if (!stampImageUrl) {
        form.setFields([
          {
            name: 'handwritten',
            errors: ['Vui lòng vẽ chữ ký hoặc chọn ảnh chữ ký đã lưu'],
          },
        ]);
        return;
      }
      onConfirm({
        action: 'handwritten',
        comment: values.comment || undefined,
        signature: {
          provider: 'handwritten',
          stampImageUrl,
          placement: placement || undefined,
        },
      });
      return;
    }

    if (!savedSignatureUrl) {
      form.setFields([
        {
          name: 'signatureImage',
          errors: ['Vui lòng tải ảnh chữ ký trước khi ký số'],
        },
      ]);
      return;
    }

    onConfirm({
      action: 'sign',
      comment: values.comment || undefined,
      signature: {
        provider: values.provider,
        pin: values.pin,
        smartCaUsername: values.smartCaUsername,
        stampImageUrl: savedSignatureUrl,
        placement: placement || undefined,
      },
    });
  };

  return (
    <Modal
      open={open}
      title={title}
      okText={isHandwritten ? 'Ký tay & duyệt' : isDigitalSign ? 'Ký số & duyệt' : 'Duyệt'}
      cancelText="Hủy"
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      width={requiresSignature ? 680 : 560}
    >
      {task && (
        <div className="mb-4">
          <Typography.Text strong>{task.formName}</Typography.Text>
          <div className="text-[var(--app-text-muted)] text-sm">
            Mã hồ sơ: {task.submissionCode} · Bước: {task.currentStep}
          </div>
        </div>
      )}

      {isHandwritten ? (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="Bạn đã chọn hình thức ký tay"
          description="Vẽ chữ ký hoặc dùng ảnh đã lưu, rồi kéo khung chữ ký tới vị trí mong muốn trên tài liệu."
        />
      ) : isDigitalSign ? (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="Bạn đã chọn hình thức ký số"
          description="Xác thực SmartCA/USB Token, rồi dán khối ký (ảnh chữ ký, Ký bởi, Ngày ký) vào vị trí bạn chọn trên tờ đơn."
        />
      ) : (
        <Alert
          type="success"
          showIcon
          className="mb-4"
          message="Bạn đã chọn duyệt thường"
          description="Không bắt buộc ký. Bạn có thể thêm ghi chú rồi duyệt."
        />
      )}

      <Spin spinning={loadingProviders}>
        <Form form={form} layout="vertical">
          {isHandwritten && (
            <>
              <Form.Item label="Nguồn chữ ký tay">
                <Radio.Group
                  value={handSource}
                  onChange={(e) => setHandSource(e.target.value)}
                  className="w-full"
                >
                  <Space direction="vertical">
                    <Radio value="draw">
                      <EditOutlined /> Vẽ chữ ký ngay
                    </Radio>
                    <Radio value="saved">Dùng ảnh chữ ký đã lưu</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>

              {handSource === 'draw' ? (
                <Form.Item name="handwritten" label="Khung ký tay">
                  <HandwrittenSignaturePad onChange={setHandDrawnDataUrl} />
                </Form.Item>
              ) : (
                <div className="mb-4 p-3 border border-[var(--app-border)] rounded-md bg-[var(--app-bg)] space-y-3">
                  {savedSignatureUrl ? (
                    <img
                      src={savedSignatureUrl}
                      alt="Ảnh chữ ký đã lưu"
                      className="max-h-28 object-contain bg-[var(--app-surface)] border border-[var(--app-border)] rounded"
                    />
                  ) : (
                    <Typography.Text type="secondary">
                      Chưa có ảnh chữ ký. Tải ảnh lên ngay tại đây để dùng ký tay.
                    </Typography.Text>
                  )}
                  <Upload
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleUploadSignature(file);
                      return false;
                    }}
                  >
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploadingSignature}
                      type={savedSignatureUrl ? 'default' : 'primary'}
                    >
                      {savedSignatureUrl ? 'Đổi ảnh chữ ký' : 'Tải ảnh chữ ký'}
                    </Button>
                  </Upload>
                </div>
              )}
            </>
          )}

          {isDigitalSign && (
            <>
              <Form.Item name="signatureImage" label="Ảnh chữ ký">
                <div className="p-3 border border-[var(--app-border)] rounded-md bg-[var(--app-bg)] space-y-3">
                  {savedSignatureUrl ? (
                    <img
                      src={savedSignatureUrl}
                      alt="Ảnh chữ ký"
                      className="max-h-28 object-contain bg-[var(--app-surface)] border border-[var(--app-border)] rounded"
                    />
                  ) : (
                    <Typography.Text type="secondary">
                      Chưa có ảnh chữ ký. Tải ảnh lên ngay tại đây để dùng ký số.
                    </Typography.Text>
                  )}
                  <Upload
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleUploadSignature(file);
                      return false;
                    }}
                  >
                    <Button
                      icon={<UploadOutlined />}
                      loading={uploadingSignature}
                      type={savedSignatureUrl ? 'default' : 'primary'}
                    >
                      {savedSignatureUrl ? 'Đổi ảnh chữ ký' : 'Tải ảnh chữ ký'}
                    </Button>
                  </Upload>
                </div>
              </Form.Item>

              <Form.Item
                name="provider"
                label="Phương thức ký số"
                rules={[{ required: true, message: 'Chọn phương thức ký số' }]}
              >
                <Radio.Group className="w-full">
                  <Space direction="vertical" className="w-full">
                    {(providers.length
                      ? providers
                      : [
                          { value: 'smartca_vnpt', label: 'VNPT SmartCA', mode: 'remote' },
                          { value: 'usb_token', label: 'USB Token', mode: 'local' },
                        ]
                    ).map((item) => (
                      <Radio key={item.value} value={item.value}>
                        {item.mode === 'local' ? <UsbOutlined /> : <SafetyCertificateOutlined />}{' '}
                        {item.label}
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>
              </Form.Item>

              {provider?.startsWith('smartca_') && (
                <>
                  {!user?.smartCaUserId && (
                    <Alert
                      type="warning"
                      showIcon
                      className="mb-3"
                      message="Chưa tích hợp SmartCA trên tài khoản"
                      description="Vào Cài đặt tài khoản → Tích hợp VNPT SmartCA để gắn CCCD/MST của bạn. Có thể nhập tạm bên dưới cho lần ký này."
                    />
                  )}
                  <Form.Item
                    name="smartCaUsername"
                    label="CCCD / MST thuê bao SmartCA"
                    rules={[{ required: true, message: 'Nhập CCCD hoặc MST của thuê bao SmartCA' }]}
                    extra={
                      user?.smartCaUserId
                        ? 'Đã điền từ Cài đặt tài khoản. Có thể sửa nếu cần dùng thuê bao khác lần này.'
                        : 'Nhập CCCD đã kích hoạt VNPT SmartCA. Mở app trên điện thoại để duyệt khi hệ thống gửi yêu cầu.'
                    }
                  >
                    <Input placeholder="vd: 083187028029" inputMode="numeric" />
                  </Form.Item>
                </>
              )}

              {provider === 'usb_token' && (
                <Form.Item
                  name="pin"
                  label="Mã PIN USB Token"
                  normalize={(v) => restrictDigitsInput(v, 12)}
                  rules={[
                    { required: true, message: 'Nhập mã PIN' },
                    { min: 4, message: 'PIN tối thiểu 4 chữ số' },
                    {
                      pattern: /^\d{4,12}$/,
                      message: 'PIN chỉ gồm 4–12 chữ số',
                    },
                  ]}
                >
                  <Input.Password placeholder="Nhập PIN token (chỉ số)" maxLength={12} inputMode="numeric" />
                </Form.Item>
              )}

              {smartCaPending && (
                <Alert
                  type="warning"
                  showIcon
                  className="mb-4"
                  message={`Đang chờ duyệt trên app VNPT SmartCA (${countdown}s)`}
                  description="Mở app VNPT SmartCA trên điện thoại và phê duyệt giao dịch. Hệ thống sẽ tự hoàn tất khi bạn xác nhận."
                />
              )}
            </>
          )}

          {requiresSignature && (
            <Form.Item label="Vị trí chữ ký trên tài liệu">
              {task?.fileUrl ? (
                <SignaturePlacer
                  fileUrl={task.fileUrl}
                  signatureImageUrl={placementPreviewImage || undefined}
                  signerName={user?.fullName || ''}
                  boxLabel={placementBoxLabel}
                  onChange={handlePlacementChange}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Không có file để chọn vị trí. Chữ ký sẽ được đặt ở trang xác nhận cuối tài liệu."
                />
              )}
            </Form.Item>
          )}

          <Form.Item name="comment" label="Ghi chú (tuỳ chọn)">
            <Input.TextArea rows={3} placeholder="Ghi chú khi duyệt / ký" />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
