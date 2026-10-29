import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Input,
  Space,
  Modal,
  Form,
  message,
  Select,
  Tag,
  Dropdown,
} from 'antd';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  DownOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { getApiErrorMessage } from '@/shared/utils/getApiErrorMessage';
import { organizationApi } from '../services/organizationApi';
import {
  QUYEN_GROUPS,
  normalizeQuyenGroup,
  quyenGroupByCode,
  quyenGroupLabel,
} from '../constants/quyenCatalog';
import { ActivityStatusTag } from '../components/ActivityStatusTag';
import { DownloadExcelTemplateButton } from '../components/DownloadExcelTemplateButton';
import { ImportExcelButton } from '../components/ImportExcelButton';
import { previewQuyenCode } from '../utils/orgCodePreview';
import type { Quyen } from '../types/organization.types';

export function QuyenPage() {
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [quyens, setQuyens] = useState<Quyen[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editing?: Quyen }>({ open: false });
  const [form] = Form.useForm();
  const quyenNameWatch = Form.useWatch('name', form);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizationApi.quyens.list({ isActive: 'all', limit: 500 });
      setQuyens(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh mục quyền'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!modal.open || modal.editing) return;
    const existing = quyens.map((q) => q.code);
    form.setFieldValue('code', previewQuyenCode(quyenNameWatch, existing));
  }, [modal.open, modal.editing, quyenNameWatch, quyens, form]);

  const resolveGroup = (row: Quyen) => normalizeQuyenGroup(row.group || quyenGroupByCode(row.code));

  const searchedQuyens = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return quyens;
    return quyens.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        quyenGroupLabel(resolveGroup(item)).toLowerCase().includes(q),
    );
  }, [quyens, search]);

  const filteredQuyens = useMemo(() => {
    if (groupFilter === 'all') return searchedQuyens;
    return searchedQuyens.filter((q) => resolveGroup(q) === groupFilter);
  }, [searchedQuyens, groupFilter]);

  const groupFilterOptions = [
    { value: 'all', label: 'Tất cả' },
    ...QUYEN_GROUPS.map((g) => ({ value: g.key, label: g.label })),
  ];

  const openCreateModal = () => {
    form.resetFields();
    setModal({ open: true });
  };

  const openEditModal = (row: Quyen) => {
    form.setFieldsValue(row);
    setModal({ open: true, editing: row });
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      if (modal.editing) {
        await organizationApi.quyens.update(modal.editing._id, {
          name: values.name,
          description: values.description,
          group: values.group,
        });
        message.success('Cập nhật quyền thành công');
      } else {
        await organizationApi.quyens.create({
          name: values.name,
          description: values.description,
          group: values.group,
        });
        message.success('Thêm quyền thành công');
      }
      setModal({ open: false });
      load();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(err, 'Không thể lưu quyền'));
    }
  };

  const handleToggleActive = (row: Quyen) => {
    const isOn = row.isActive !== false;
    if (isOn) {
      Modal.confirm({
        title: 'Ngừng hoạt động quyền?',
        content:
          'Quyền sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
        okText: 'Ngừng hoạt động',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await organizationApi.quyens.remove(row._id);
            message.success('Đã chuyển sang ngừng hoạt động');
            load();
          } catch (err) {
            message.error(getApiErrorMessage(err, 'Không thể ngừng hoạt động quyền'));
          }
        },
      });
      return;
    }
    Modal.confirm({
      title: 'Kích hoạt lại quyền?',
      content: 'Quyền sẽ trở lại trạng thái Đang hoạt động.',
      okText: 'Kích hoạt lại',
      onOk: async () => {
        try {
          await organizationApi.quyens.update(row._id, { isActive: true });
          message.success('Đã kích hoạt lại');
          load();
        } catch (err) {
          message.error(getApiErrorMessage(err, 'Không thể kích hoạt lại quyền'));
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quản lý Quyền"
        subtitle="Danh mục quyền theo nhóm tổ chức — từ ngữ và nhóm dùng chung với Người dùng / Quy trình"
      />

      <Card className="border border-[var(--app-border)] shadow-none rounded-xl">
        <Space wrap className="mb-4">
          <Select
            value={groupFilter}
            onChange={setGroupFilter}
            options={groupFilterOptions}
            style={{ width: 200 }}
            placeholder="Chọn nhóm"
          />
          <Input
            prefix={<SearchOutlined />}
            placeholder="Tìm quyền..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Thêm quyền
          </Button>
          <DownloadExcelTemplateButton kind="quyen" />
          <ImportExcelButton onImport={organizationApi.quyens.import} onDone={load} />
        </Space>

        <ResponsiveTable
          rowKey="_id"
          loading={loading}
          dataSource={filteredQuyens}
          pagination={false}
          locale={{ emptyText: 'Chưa có quyền trong nhóm này — bấm Thêm quyền hoặc chạy seed' }}
          columns={[
            { title: 'Mã', dataIndex: 'code', width: 180 },
            { title: 'Tên quyền', dataIndex: 'name' },
            {
              title: 'Nhóm',
              width: 140,
              render: (_, r) => <Tag>{quyenGroupLabel(resolveGroup(r))}</Tag>,
            },
            {
              title: 'Mô tả',
              dataIndex: 'description',
              ellipsis: true,
              render: (v?: string) => v || '—',
            },
            {
              title: 'Trạng thái',
              width: 140,
              render: (_: unknown, r: Quyen) => <ActivityStatusTag active={r.isActive} />,
            },
            {
              title: 'Thao tác',
              width: 140,
              render: (_, r) => (
                <Dropdown.Button
                  size="small"
                  icon={<DownOutlined />}
                  onClick={() => openEditModal(r)}
                  menu={{
                    items: [
                      r.isActive !== false
                        ? {
                            key: 'deactivate',
                            icon: <DeleteOutlined className="text-red-500" />,
                            danger: true,
                            label: <span className="text-red-500">Ngừng hoạt động</span>,
                            onClick: () => handleToggleActive(r),
                          }
                        : {
                            key: 'activate',
                            icon: <CheckCircleOutlined className="text-emerald-500" />,
                            label: <span className="text-emerald-600">Kích hoạt lại</span>,
                            onClick: () => handleToggleActive(r),
                          },
                    ],
                  }}
                >
                  <EditOutlined /> Sửa
                </Dropdown.Button>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={modal.open}
        title={modal.editing ? 'Sửa quyền' : 'Thêm quyền'}
        onCancel={() => setModal({ open: false })}
        onOk={save}
        okText={modal.editing ? 'Cập nhật' : 'Thêm mới'}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="pt-2">
          <Form.Item name="code" label="Mã quyền">
            <Input disabled placeholder="Nhập tên quyền để xem mã" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên hiển thị"
            rules={[{ required: true, message: 'Nhập tên quyền' }]}
          >
            <Input placeholder="Ví dụ: Trưởng khoa" />
          </Form.Item>
          <Form.Item
            name="group"
            label="Nhóm"
            rules={[{ required: true, message: 'Chọn nhóm quyền' }]}
          >
            <Select
              placeholder="Chọn nhóm"
              options={QUYEN_GROUPS.map((g) => ({ value: g.key, label: g.label }))}
            />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} placeholder="Mô tả ngắn" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
