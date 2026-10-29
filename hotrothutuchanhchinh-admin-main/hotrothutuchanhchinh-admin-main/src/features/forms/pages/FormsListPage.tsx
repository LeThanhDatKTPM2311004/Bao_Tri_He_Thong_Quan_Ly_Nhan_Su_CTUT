// [ADMIN-PORTAL] Trang quản lý mẫu Word — không dùng cho sinh viên (xem repo hotrothutuchanhchinh-fe)
import { useState, useEffect, useMemo } from 'react';
import {
  Row,
  Col,
  Button,
  Upload,
  message,
  Space,
  Tag,
  Modal,
  Spin,
  Input,
  Dropdown,
} from 'antd';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import { CellText } from '@/shared/components/ui/CellText';
import {
  ImportOutlined,
  SendOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  EditOutlined,
  DownOutlined,
  SettingOutlined,
  CheckCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { renderAsync } from 'docx-preview';
import type { UploadFile } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import { wordTemplatesApi } from '../services/formsApi';
import type { ImportedForm } from '../types/forms.types';
import { workflowsApi } from '@/features/workflows/services/workflowsApi';
import type { FormWorkflowOption } from '@/features/workflows/types/workflows.types';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const isDocxFile = (file: File) =>
  file.name.toLowerCase().endsWith('.docx') ||
  file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const sanitizeFormName = (value: string) =>
  value
    .replace(/[^\p{L}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 40);

export function FormsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [templates, setTemplates] = useState<ImportedForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [workflowMap, setWorkflowMap] = useState<Record<string, FormWorkflowOption>>({});
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isPreviewGenerating, setIsPreviewGenerating] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingForm, setEditingForm] = useState<ImportedForm | null>(null);
  const [editTenDon, setEditTenDon] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [filterQuery, setFilterQuery] = useState(() => searchParams.get('q') || '');

  useEffect(() => {
    setFilterQuery(searchParams.get('q') || '');
  }, [searchParams]);

  const filteredTemplates = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) =>
      `${t.tenDon} ${t.description || ''}`.toLowerCase().includes(q),
    );
  }, [templates, filterQuery]);

  const fetchTemplates = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const response = await wordTemplatesApi.list();
      if (response.data.success) {
        setTemplates(response.data.data);
      }
      const workflowRes = await workflowsApi.listFormConfigs();
      const wordConfigs = (workflowRes.data.data || []).filter((item) => item.formType === 'word');
      setWorkflowMap(Object.fromEntries(wordConfigs.map((item) => [item.formId, item])));
    } catch (error) {
      if (!opts?.silent) {
        message.error(getErrorMessage(error) || 'Không thể tải danh sách biểu mẫu');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTemplates();
  }, []);

  useLiveRefresh(() => fetchTemplates({ silent: true }));

  const handleImport = async () => {
    if (fileList.length === 0) {
      message.warning('Vui lòng chọn file để import!');
      return;
    }

    const files = fileList
      .map((item) => (item.originFileObj || item) as File)
      .filter((file) => file && typeof file.name === 'string');

    const invalid = files.filter((file) => !isDocxFile(file));
    if (invalid.length > 0) {
      message.error('Chỉ chấp nhận file .docx');
      return;
    }
    if (files.length === 0) {
      message.warning('Vui lòng chọn file .docx hợp lệ!');
      return;
    }

    setUploading(true);
    let successCount = 0;
    const failures: string[] = [];

    try {
      for (const file of files) {
        try {
          await wordTemplatesApi.importTemplate(file, file.name.replace(/\.docx$/i, ''));
          successCount += 1;
        } catch (error) {
          failures.push(`${file.name}: ${getErrorMessage(error) || 'thất bại'}`);
        }
      }

      if (successCount > 0 && failures.length === 0) {
        message.success(
          successCount === 1
            ? 'Import biểu mẫu thành công!'
            : `Đã import thành công ${successCount} biểu mẫu`,
        );
      } else if (successCount > 0) {
        message.warning(`Import xong ${successCount}/${files.length}. Lỗi: ${failures.join('; ')}`);
      } else {
        message.error(failures[0] || 'Import thất bại, vui lòng thử lại!');
      }

      if (successCount > 0) {
        setFileList([]);
        await fetchTemplates();
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (record: ImportedForm) => {
    try {
      await wordTemplatesApi.downloadTemplate(
        record._id,
        record.originalFileName || `${record.tenDon}.docx`,
      );
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không tải được mẫu');
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await wordTemplatesApi.delete(id);
      message.success('Đã chuyển sang ngừng hoạt động');
      await fetchTemplates();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể ngừng hoạt động biểu mẫu');
    }
  };

  const handleReactivate = async (id: string) => {
    try {
      await wordTemplatesApi.update(id, { isActive: true });
      message.success('Đã kích hoạt lại');
      await fetchTemplates();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể kích hoạt lại biểu mẫu');
    }
  };

  const openEditName = (record: ImportedForm) => {
    setEditingForm(record);
    setEditTenDon(record.tenDon);
    setEditModalVisible(true);
  };

  const handleSaveName = async () => {
    if (!editingForm) return;
    const trimmed = sanitizeFormName(editTenDon).trim();
    if (!trimmed) {
      message.warning('Tên đơn không được để trống');
      return;
    }
    setSavingName(true);
    try {
      await wordTemplatesApi.update(editingForm._id, { tenDon: trimmed });
      message.success('Đã cập nhật tên đơn');
      setEditModalVisible(false);
      setEditingForm(null);
      await fetchTemplates();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Cập nhật thất bại');
    } finally {
      setSavingName(false);
    }
  };

  const handlePreview = async (record: ImportedForm) => {
    setPreviewTitle(record.tenDon);
    setPreviewModalVisible(true);
    setIsPreviewGenerating(true);

    try {
      const blob = await wordTemplatesApi.previewTemplate(record.templateFile);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const container = document.getElementById('preview-container');
      if (container) {
        container.innerHTML = '';
        await renderAsync(blob, container, undefined, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          useBase64URL: false,
          renderChanges: false,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
      }
    } catch (error) {
      message.error(getErrorMessage(error) || 'Lỗi khi tạo bản xem trước');
    } finally {
      setIsPreviewGenerating(false);
    }
  };

  const uploadProps = {
    accept: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    multiple: true,
    onRemove: (file: UploadFile) => {
      setFileList((prev) => prev.filter((item) => item.uid !== file.uid));
    },
    beforeUpload: (file: File) => {
      if (!isDocxFile(file)) {
        message.error(`"${file.name}" không phải file .docx`);
        return Upload.LIST_IGNORE;
      }
      setFileList((prev) => {
        const exists = prev.some(
          (item) => item.name === file.name && item.size === file.size,
        );
        if (exists) return prev;
        return [...prev, file as unknown as UploadFile];
      });
      return false;
    },
    fileList,
  };

  const adminColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      render: (_: unknown, __: unknown, index: number) => index + 1,
    },
    {
      title: 'Tên đơn',
      dataIndex: 'tenDon',
      key: 'tenDon',
      width: 240,
      ellipsis: true,
      render: (text: string) => <CellText strong>{text}</CellText>,
    },
    {
      title: 'Quy trình',
      key: 'workflow',
      width: 140,
      ellipsis: true,
      render: (_: unknown, record: ImportedForm) => {
        const config = workflowMap[record._id];
        return config?.hasCustomWorkflow ? (
          <Tag color="green">{config.stepsCount} bước riêng</Tag>
        ) : (
          <Tag>dùng mặc định</Tag>
        );
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      ellipsis: true,
      render: (text: string) => {
        const label = new Date(text).toLocaleString('vi-VN');
        return <CellText title={label}>{label}</CellText>;
      },
    },
    {
      title: 'Trạng thái',
      key: 'isActive',
      width: 140,
      render: (_: unknown, record: ImportedForm) =>
        record.isActive !== false ? (
          <Tag color="success">Đang hoạt động</Tag>
        ) : (
          <Tag>Ngừng hoạt động</Tag>
        ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: ImportedForm) => {
        const isOn = record.isActive !== false;
        return (
          <Dropdown.Button
            size="small"
            icon={<DownOutlined />}
            onClick={() => void handlePreview(record)}
            menu={{
              items: [
                {
                  key: 'edit',
                  icon: <EditOutlined />,
                  label: 'Sửa tên',
                  onClick: () => openEditName(record),
                },
                {
                  key: 'download',
                  icon: <DownloadOutlined />,
                  label: 'Tải mẫu',
                  disabled: !isOn,
                  onClick: () => void handleDownload(record),
                },
                {
                  key: 'workflow',
                  icon: <SettingOutlined />,
                  label: 'Cấu hình quy trình',
                  disabled: !isOn,
                  onClick: () => navigate(`/workflows/pending?formType=word&formId=${record._id}`),
                },
                { type: 'divider' },
                isOn
                  ? {
                      key: 'deactivate',
                      icon: <DeleteOutlined className="text-red-500" />,
                      label: <span className="text-red-500">Ngừng hoạt động</span>,
                      danger: true,
                      onClick: () => {
                        Modal.confirm({
                          title: 'Ngừng hoạt động biểu mẫu?',
                          content:
                            'Biểu mẫu vẫn nằm trong danh sách. Bên sinh viên đơn này vẫn hiện, có ổ khóa và không thao tác được.',
                          okText: 'Ngừng hoạt động',
                          cancelText: 'Hủy',
                          okButtonProps: { danger: true },
                          onOk: () => handleDeactivate(record._id),
                        });
                      },
                    }
                  : {
                      key: 'activate',
                      icon: <CheckCircleOutlined className="text-emerald-500" />,
                      label: <span className="text-emerald-600">Kích hoạt lại</span>,
                      onClick: () => {
                        Modal.confirm({
                          title: 'Kích hoạt lại biểu mẫu?',
                          content: 'Biểu mẫu sẽ trở lại trạng thái Đang hoạt động.',
                          okText: 'Kích hoạt lại',
                          cancelText: 'Hủy',
                          onOk: () => handleReactivate(record._id),
                        });
                      },
                    },
              ],
            }}
          >
            <EyeOutlined /> Xem
          </Dropdown.Button>
        );
      },
    },
  ];

  const previewModal = (
    <Modal
      title={`Xem trước: ${previewTitle}`}
      open={previewModalVisible}
      onCancel={() => {
        setPreviewModalVisible(false);
        const container = document.getElementById('preview-container');
        if (container) container.innerHTML = '';
      }}
      footer={null}
      width={1000}
      style={{ top: 20 }}
      destroyOnClose
    >
      <div
        style={{
          position: 'relative',
          height: '80vh',
          width: '100%',
          overflow: 'auto',
          background: 'var(--app-bg)',
          padding: '16px',
        }}
      >
        {isPreviewGenerating && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.7)',
              zIndex: 10,
            }}
          >
            <Spin tip="Đang tải tài liệu..." size="large" />
          </div>
        )}
        <div
          id="preview-container"
          style={{
            background: 'var(--app-surface)',
            minHeight: '100%',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--app-border)',
          }}
        />
      </div>
    </Modal>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Biểu mẫu thủ tục" subtitle="Danh sách biểu mẫu điện tử" />
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <div className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
            <Space size="middle" align="center" wrap>
              <Upload {...uploadProps}>
                <Button icon={<ImportOutlined />}>Import</Button>
              </Upload>
              <Button
                type="primary"
                onClick={() => void handleImport()}
                disabled={fileList.length === 0}
                loading={uploading}
                icon={<SendOutlined />}
              >
                {fileList.length > 1 ? `Submit (${fileList.length})` : 'Submit'}
              </Button>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Lọc theo tên đơn…"
                value={filterQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterQuery(value);
                  const next = new URLSearchParams(searchParams);
                  if (value.trim()) next.set('q', value.trim());
                  else next.delete('q');
                  setSearchParams(next, { replace: true });
                }}
                className="w-full sm:w-[280px] max-w-full"
              />
            </Space>
          </div>
        </Col>
        <Col span={24}>
          {templates.length === 0 && !loading ? (
            <EmptyState description="Chưa có biểu mẫu nào" />
          ) : (
            <ResponsiveTable
              dataSource={filteredTemplates}
              columns={adminColumns}
              rowKey="_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              expandable={{
                expandedRowRender: (record: ImportedForm) => (
                  <div style={{ margin: '8px 0' }}>
                    <p style={{ fontWeight: 600, marginBottom: 8 }}>
                      Danh sách các trường dữ liệu ({record.chiTiet?.length || 0}):
                    </p>
                    <Space size={[8, 8]} wrap>
                      {record.chiTiet?.map((item) => (
                        <Tag key={item._id} color="blue" style={{ padding: '4px 8px' }}>
                          <span style={{ fontWeight: 500 }}>{item.moTa}</span>
                          {item.placeHolder && item.placeHolder !== item.moTa && (
                            <span style={{ opacity: 0.7, marginLeft: 4 }}>
                              ({item.placeHolder})
                            </span>
                          )}
                        </Tag>
                      ))}
                    </Space>
                  </div>
                ),
                rowExpandable: (record) => (record.chiTiet?.length || 0) > 0,
              }}
            />
          )}
        </Col>
      </Row>
      {previewModal}

      <Modal
        title="Sửa tên đơn"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingForm(null);
        }}
        onOk={() => void handleSaveName()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={savingName}
        destroyOnClose
      >
        <div className="py-2">
          <label className="block text-sm font-medium text-[var(--app-text-muted)] mb-2">Tên đơn</label>
          <Input
            value={editTenDon}
            onChange={(e) => setEditTenDon(sanitizeFormName(e.target.value))}
            placeholder="Nhập tên đơn / biểu mẫu"
            maxLength={40}
            onPressEnter={() => void handleSaveName()}
          />
        </div>
      </Modal>
    </div>
  );
}
