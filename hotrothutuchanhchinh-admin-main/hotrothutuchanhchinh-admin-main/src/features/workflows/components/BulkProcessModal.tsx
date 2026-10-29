import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  List,
  Modal,
  Progress,
  Radio,
  Space,
  Spin,
  Typography,
  Upload,
  message,
} from 'antd';
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
import type { SignApprovePayload } from './SignApproveModal';

interface BulkProcessModalProps {
  open: boolean;
  tasks: PendingTask[];
  mode: StaffProcessMode | 'reject';
  loading?: boolean;
  progress?: { done: number; total: number } | null;
  onCancel: () => void;
  onConfirm: (payload: Omit<SignApprovePayload, 'action'> & { action: StaffProcessMode | 'reject' }) => void;
}

export function BulkProcessModal({
  open,
  tasks,
  mode,
  loading,
  progress,
  onCancel,
  onConfirm,
}: BulkProcessModalProps) {
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

  const isReject = mode === 'reject';
  const isDigitalSign = mode === 'sign';
  const isHandwritten = mode === 'handwritten';
  const requiresSignature = isDigitalSign || isHandwritten;
  const provider = Form.useWatch('provider', form);
  const savedSignatureUrl = localSignatureUrl || user?.signatureImageUrl || '';

  const formNames = useMemo(
    () => [...new Set(tasks.map((t) => t.formName).filter(Boolean))],
    [tasks],
  );
  const mixedForms = formNames.length > 1;
  const sampleTask = tasks.find((t) => t.fileUrl) || tasks[0] || null;

  const placementPreviewImage = isHandwritten
    ? handSource === 'saved'
      ? savedSignatureUrl
      : handDrawnDataUrl || ''
    : savedSignatureUrl;

  const handlePlacementChange = useCallback((next: SignaturePlacement) => setPlacement(next), []);

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
      message.success('Đã tải ảnh chữ ký');
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setUploadingSignature(false);
    }
    return false;
  };

  const title = useMemo(() => {
    const n = tasks.length;
    if (isReject) return `Từ chối hàng loạt (${n} hồ sơ)`;
    if (isHandwritten) return `Ký tay hàng loạt (${n} hồ sơ)`;
    if (isDigitalSign) return `Ký số hàng loạt (${n} hồ sơ)`;
    return `Duyệt hàng loạt (${n} hồ sơ)`;
  }, [tasks.length, isReject, isHandwritten, isDigitalSign]);

  const handleOk = async () => {
    const values = await form.validateFields();

    if (requiresSignature && mixedForms) {
      message.error('Ký hàng loạt chỉ áp dụng khi các hồ sơ cùng một loại đơn. Hãy lọc theo loại đơn trước.');
      return;
    }

    if (isReject) {
      onConfirm({ action: 'reject', comment: values.comment || undefined });
      return;
    }

    if (!requiresSignature) {
      onConfirm({ action: 'approve', comment: values.comment || undefined });
      return;
    }

    if (isHandwritten) {
      const stampImageUrl =
        handSource === 'saved' && savedSignatureUrl ? savedSignatureUrl : handDrawnDataUrl;
      if (!stampImageUrl) {
        message.error('Vui lòng vẽ chữ ký hoặc chọn ảnh chữ ký đã lưu');
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
      message.error('Vui lòng tải ảnh chữ ký trước khi ký số');
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

  const okText = isReject
    ? 'Từ chối tất cả'
    : isHandwritten
      ? 'Ký tay tất cả'
      : isDigitalSign
        ? 'Ký số tất cả'
        : 'Duyệt tất cả';

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="Hủy"
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnClose
      width={requiresSignature ? 720 : 560}
      okButtonProps={{ danger: isReject }}
    >
      <Alert
        type={isReject ? 'warning' : mixedForms && requiresSignature ? 'error' : 'info'}
        showIcon
        className="mb-3"
        message={
          isReject
            ? 'Các hồ sơ đã chọn sẽ bị từ chối'
            : requiresSignature
              ? mixedForms
                ? 'Đang chọn nhiều loại đơn khác nhau — không thể ký hàng loạt. Lọc cùng một loại đơn rồi thử lại.'
                : `Chữ ký / vị trí sẽ áp dụng cho ${tasks.length} hồ sơ cùng loại «${formNames[0] || ''}»`
              : `Duyệt thường ${tasks.length} hồ sơ đã chọn (không đóng dấu PDF)`
        }
      />

      <List
        size="small"
        className="mb-3 max-h-36 overflow-y-auto border border-[var(--app-border)] rounded-md"
        dataSource={tasks.slice(0, 30)}
        footer={
          tasks.length > 30 ? (
            <Typography.Text type="secondary">… và {tasks.length - 30} hồ sơ khác</Typography.Text>
          ) : null
        }
        renderItem={(t) => (
          <List.Item className="!px-3 !py-1">
            <Typography.Text code>{t.submissionCode}</Typography.Text>
            <Typography.Text ellipsis className="ml-2 flex-1">
              {t.formName} — {t.submittedBy}
            </Typography.Text>
          </List.Item>
        )}
      />

      {progress && progress.total > 0 && (
        <Progress
          className="mb-3"
          percent={Math.round((progress.done / progress.total) * 100)}
          format={() => `${progress.done}/${progress.total}`}
        />
      )}

      <Spin spinning={loadingProviders}>
        <Form form={form} layout="vertical" disabled={!!loading}>
          {isHandwritten && (
            <>
              <Form.Item label="Nguồn chữ ký tay">
                <Radio.Group value={handSource} onChange={(e) => setHandSource(e.target.value)}>
                  <Space direction="vertical">
                    <Radio value="draw">
                      <EditOutlined /> Vẽ chữ ký ngay
                    </Radio>
                    <Radio value="saved">Dùng ảnh chữ ký đã lưu</Radio>
                  </Space>
                </Radio.Group>
              </Form.Item>
              {handSource === 'draw' ? (
                <Form.Item label="Khung ký tay">
                  <HandwrittenSignaturePad onChange={setHandDrawnDataUrl} />
                </Form.Item>
              ) : (
                <div className="mb-4 p-3 border border-[var(--app-border)] rounded-md space-y-3">
                  {savedSignatureUrl ? (
                    <img
                      src={savedSignatureUrl}
                      alt="Chữ ký"
                      className="max-h-28 object-contain border rounded"
                    />
                  ) : (
                    <Typography.Text type="secondary">Chưa có ảnh chữ ký đã lưu.</Typography.Text>
                  )}
                  <Upload
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleUploadSignature(file);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingSignature}>
                      {savedSignatureUrl ? 'Đổi ảnh' : 'Tải ảnh chữ ký'}
                    </Button>
                  </Upload>
                </div>
              )}
            </>
          )}

          {isDigitalSign && (
            <>
              <Form.Item label="Ảnh chữ ký">
                <div className="p-3 border border-[var(--app-border)] rounded-md space-y-3">
                  {savedSignatureUrl ? (
                    <img
                      src={savedSignatureUrl}
                      alt="Chữ ký"
                      className="max-h-28 object-contain border rounded"
                    />
                  ) : (
                    <Typography.Text type="secondary">Chưa có ảnh chữ ký.</Typography.Text>
                  )}
                  <Upload
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      void handleUploadSignature(file);
                      return false;
                    }}
                  >
                    <Button icon={<UploadOutlined />} loading={uploadingSignature}>
                      {savedSignatureUrl ? 'Đổi ảnh' : 'Tải ảnh chữ ký'}
                    </Button>
                  </Upload>
                </div>
              </Form.Item>
              <Form.Item
                name="provider"
                label="Nhà cung cấp"
                rules={[{ required: true, message: 'Chọn nhà cung cấp' }]}
              >
                <Radio.Group>
                  <Space direction="vertical">
                    {(providers.length
                      ? providers
                      : [
                          { value: 'smartca_vnpt', label: 'VNPT SmartCA' },
                          { value: 'usb_token', label: 'USB Token' },
                        ]
                    ).map((p) => (
                      <Radio key={p.value} value={p.value}>
                        {p.value === 'usb_token' ? <UsbOutlined /> : <SafetyCertificateOutlined />}{' '}
                        {p.label}
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
                      description="Vào Cài đặt tài khoản → Tích hợp VNPT SmartCA để gắn CCCD/MST của bạn."
                    />
                  )}
                  <Form.Item
                    name="smartCaUsername"
                    label="CCCD / MST thuê bao SmartCA"
                    rules={[{ required: true, message: 'Nhập CCCD hoặc MST của thuê bao SmartCA' }]}
                    extra={
                      user?.smartCaUserId
                        ? 'Đã điền từ Cài đặt tài khoản. Mỗi lần ký gửi yêu cầu tới app SmartCA của thuê bao này.'
                        : 'Mỗi lần ký sẽ gửi yêu cầu tới app VNPT SmartCA của thuê bao này.'
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
                  ]}
                >
                  <Input.Password maxLength={12} inputMode="numeric" />
                </Form.Item>
              )}
              {smartCaPending && (
                <Alert
                  type="warning"
                  showIcon
                  className="mb-4"
                  message={`Đang chờ duyệt trên app VNPT SmartCA (${countdown}s)`}
                  description="Mở app VNPT SmartCA và phê duyệt từng giao dịch (ký hàng loạt gửi tuần tự)."
                />
              )}
            </>
          )}

          {requiresSignature && !mixedForms && (
            <Form.Item
              label="Vị trí chữ ký (áp dụng chung cho cả lô — chọn trên hồ sơ mẫu)"
            >
              {sampleTask?.fileUrl ? (
                <SignaturePlacer
                  fileUrl={sampleTask.fileUrl}
                  signatureImageUrl={placementPreviewImage || undefined}
                  signerName={user?.fullName || ''}
                  boxLabel={isHandwritten ? 'CHỮ KÝ TAY' : 'CHỮ KÝ SỐ'}
                  onChange={handlePlacementChange}
                />
              ) : (
                <Alert
                  type="warning"
                  showIcon
                  message="Không có file mẫu để chọn vị trí. Hệ thống sẽ đặt chữ ký ở trang xác nhận cuối."
                />
              )}
            </Form.Item>
          )}

          <Form.Item name="comment" label="Ghi chú chung (tuỳ chọn)">
            <Input.TextArea rows={2} placeholder="Ghi chú áp dụng cho cả lô" />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
