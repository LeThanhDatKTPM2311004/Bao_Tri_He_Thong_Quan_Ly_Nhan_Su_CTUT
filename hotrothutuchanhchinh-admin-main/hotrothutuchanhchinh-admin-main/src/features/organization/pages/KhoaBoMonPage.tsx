import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Card, Button, Input, Space, Modal, Form, message, Tabs, Select, Dropdown } from 'antd';
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
import { noWhitespaceOnlyRule } from '@/shared/utils/formInput';
import {
  khoaNamePatternRule,
  KHOA_CODE_MAX_LENGTH,
  KHOA_FIELD_MAX_LENGTH,
  khoaMaxLengthRule,
} from '../constants/khoaValidation';
import { organizationApi } from '../services/organizationApi';
import { ImportExcelButton } from '../components/ImportExcelButton';
import { DownloadExcelTemplateButton } from '../components/DownloadExcelTemplateButton';
import { ActivityStatusTag } from '../components/ActivityStatusTag';
import { previewBoMonCode, previewKhoaCode } from '../utils/orgCodePreview';
import type { BoMon, Khoa } from '../types/organization.types';

export function KhoaBoMonPage() {
  const [khoas, setKhoas] = useState<Khoa[]>([]);
  const [boMons, setBoMons] = useState<BoMon[]>([]);
  const [selectedKhoa, setSelectedKhoa] = useState<Khoa | null>(null);
  const [loadingKhoa, setLoadingKhoa] = useState(false);
  const [loadingBoMon, setLoadingBoMon] = useState(false);
  const [mainTab, setMainTab] = useState<'khoa' | 'bo-mon'>('khoa');
  const [khoaModal, setKhoaModal] = useState<{ open: boolean; editing?: Khoa }>({ open: false });
  const [boMonModal, setBoMonModal] = useState<{ open: boolean; editing?: BoMon }>({ open: false });
  const [khoaForm] = Form.useForm();
  const [boMonForm] = Form.useForm();
  const [searchKhoa, setSearchKhoa] = useState('');
  const [searchBoMon, setSearchBoMon] = useState('');
  const [allKhoaCodes, setAllKhoaCodes] = useState<string[]>([]);
  const trimmedSearchKhoa = searchKhoa.trim();

  const khoaNameWatch = Form.useWatch('name', khoaForm);
  const boMonNameWatch = Form.useWatch('name', boMonForm);

  useEffect(() => {
    if (!khoaModal.open || khoaModal.editing) return;
    khoaForm.setFieldValue('code', previewKhoaCode(khoaNameWatch, allKhoaCodes));
  }, [khoaNameWatch, khoaModal.open, khoaModal.editing, allKhoaCodes, khoaForm]);

  useEffect(() => {
    if (!boMonModal.open || boMonModal.editing) return;
    const existing = boMons.map((b) => b.code);
    boMonForm.setFieldValue('code', previewBoMonCode(boMonNameWatch, existing));
  }, [boMonNameWatch, boMonModal.open, boMonModal.editing, boMons, boMonForm]);

  const loadKhoas = useCallback(async () => {
    setLoadingKhoa(true);
    try {
      const res = await organizationApi.khoas.list({
        search: trimmedSearchKhoa || undefined,
        limit: 200,
        isActive: 'all',
      });
      const list = res.data.data;
      setKhoas(list);
      setSelectedKhoa((prev) => {
        if (prev && list.some((k) => k._id === prev._id)) return prev;
        return null;
      });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách khoa'));
    } finally {
      setLoadingKhoa(false);
    }
  }, [trimmedSearchKhoa]);

  const loadBoMons = useCallback(async () => {
    if (!selectedKhoa) {
      setBoMons([]);
      return;
    }
    setLoadingBoMon(true);
    try {
      const res = await organizationApi.boMons.list({
        khoaId: selectedKhoa._id,
        search: searchBoMon || undefined,
        limit: 200,
        isActive: 'all',
      });
      setBoMons(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách bộ môn'));
    } finally {
      setLoadingBoMon(false);
    }
  }, [selectedKhoa, searchBoMon]);

  useEffect(() => {
    loadKhoas();
  }, [loadKhoas]);
  useEffect(() => {
    loadBoMons();
  }, [loadBoMons]);

  const loadAllKhoaCodes = useCallback(async () => {
    const res = await organizationApi.khoas.list({ limit: 500, isActive: 'all' });
    setAllKhoaCodes(res.data.data.map((k) => k.code.toUpperCase()));
  }, []);

  const requireSelectedKhoa = (action: string) => {
    if (!selectedKhoa) {
      message.warning(`Vui lòng chọn khoa trước khi ${action}`);
      return false;
    }
    return true;
  };

  const openCreateKhoaModal = () => {
    khoaForm.resetFields();
    void loadAllKhoaCodes();
    setKhoaModal({ open: true });
  };

  const openCreateBoMonModal = () => {
    if (!requireSelectedKhoa('thêm bộ môn')) return;
    boMonForm.resetFields();
    setBoMonModal({ open: true });
  };

  const handleSelectKhoa = (khoa: Khoa | null) => {
    setSelectedKhoa(khoa);
    if (khoa) setMainTab('bo-mon');
  };

  const handleSaveKhoa = async (values: { code: string; name: string; description?: string }) => {
    try {
      const payload = {
        ...values,
        code: String(values.code).trim().toUpperCase(),
        name: String(values.name).trim(),
      };
      if (khoaModal.editing) {
        await organizationApi.khoas.update(khoaModal.editing._id, payload);
        message.success('Cập nhật khoa thành công');
      } else {
        await organizationApi.khoas.create(payload);
        message.success('Thêm khoa thành công');
      }
      setKhoaModal({ open: false });
      loadKhoas();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) {
        throw err;
      }
      message.error(getApiErrorMessage(err, 'Không thể lưu thông tin khoa'));
      throw err;
    }
  };

  const confirmSaveKhoa = () =>
    khoaForm
      .validateFields()
      .then(handleSaveKhoa)
      .catch((err) => Promise.reject(err));

  const handleKhoaEnterSave = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    void confirmSaveKhoa();
  };

  const handleSaveBoMon = async (values: { code: string; name: string; description?: string }) => {
    if (!requireSelectedKhoa('lưu bộ môn')) return;
    try {
      const payload = { ...values, khoaId: selectedKhoa!._id };
      if (boMonModal.editing) {
        await organizationApi.boMons.update(boMonModal.editing._id, payload);
        message.success('Cập nhật bộ môn thành công');
      } else {
        await organizationApi.boMons.create(payload);
        message.success('Thêm bộ môn thành công');
      }
      setBoMonModal({ open: false });
      loadBoMons();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) {
        throw err;
      }
      message.error(getApiErrorMessage(err, 'Không thể lưu thông tin bộ môn'));
      throw err;
    }
  };

  const confirmSaveBoMon = () =>
    boMonForm
      .validateFields()
      .then(handleSaveBoMon)
      .catch((err) => Promise.reject(err));

  const handleBoMonEnterSave = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    void confirmSaveBoMon();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Quản lý Khoa & Bộ môn" subtitle="Cơ cấu tổ chức theo khoa và bộ môn" />

      <Tabs
        activeKey={mainTab}
        onChange={(key) => setMainTab(key as 'khoa' | 'bo-mon')}
        items={[
          {
            key: 'khoa',
            label: 'Khoa',
            children: (
              <Card
                className="org-card-stack-header border border-[var(--app-border)] shadow-none rounded-xl"
                title={
                  <div className="flex flex-col gap-2 py-0.5">
                    <span className="whitespace-normal break-words leading-snug">Danh sách khoa</span>
                    <Space wrap size={[8, 8]}>
                      <DownloadExcelTemplateButton kind="khoa" size="small" />
                      <ImportExcelButton size="small" onImport={organizationApi.khoas.import} onDone={loadKhoas} />
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateKhoaModal}>
                        Thêm
                      </Button>
                    </Space>
                  </div>
                }
              >
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="Tìm khoa..."
                  className="mb-3"
                  value={searchKhoa}
                  onChange={(e) => setSearchKhoa(e.target.value)}
                  onBlur={() => setSearchKhoa((s) => s.trim())}
                  allowClear
                />
                <p className="text-xs text-[var(--app-text-muted)] mb-3">
                  Chọn một khoa rồi chuyển sang tab <strong>Bộ môn</strong> để quản lý bộ môn thuộc khoa đó.
                  Import Excel: cột <strong>Mã/Mã khoa</strong> và <strong>Tên/Tên khoa</strong>.
                </p>
                <ResponsiveTable
                  rowKey="_id"
                  size="small"
                  loading={loadingKhoa}
                  dataSource={khoas}
                  pagination={false}
                  topScrollbar={false}
                  scroll={false}
                  tableLayout="fixed"
                  rowSelection={{
                    type: 'radio',
                    selectedRowKeys: selectedKhoa ? [selectedKhoa._id] : [],
                    onChange: (_, rows) => handleSelectKhoa(rows[0] ?? null),
                  }}
                  columns={[
                    { title: 'Mã', dataIndex: 'code', width: '18%', ellipsis: true },
                    { title: 'Tên khoa', dataIndex: 'name', width: '42%', ellipsis: true },
                    {
                      title: 'Trạng thái',
                      width: '20%',
                      render: (_: unknown, r: Khoa) => <ActivityStatusTag active={r.isActive} />,
                    },
                    {
                      title: 'Thao tác',
                      width: '20%',
                      render: (_, r) => (
                        <Dropdown.Button
                          size="small"
                          icon={<DownOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            khoaForm.setFieldsValue(r);
                            void loadAllKhoaCodes();
                            setKhoaModal({ open: true, editing: r });
                          }}
                          menu={{
                            onClick: ({ domEvent }) => domEvent.stopPropagation(),
                            items: [
                              r.isActive !== false
                                ? {
                                    key: 'deactivate',
                                    icon: <DeleteOutlined className="text-red-500" />,
                                    danger: true,
                                    label: <span className="text-red-500">Ngừng hoạt động</span>,
                                    onClick: () => {
                                      Modal.confirm({
                                        title: 'Ngừng hoạt động khoa?',
                                        content:
                                          'Khoa sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
                                        okText: 'Ngừng hoạt động',
                                        okButtonProps: { danger: true },
                                        onOk: async () => {
                                          try {
                                            await organizationApi.khoas.remove(r._id);
                                            message.success('Đã chuyển sang ngừng hoạt động');
                                            loadKhoas();
                                          } catch (err) {
                                            message.error(
                                              getApiErrorMessage(err, 'Không thể ngừng hoạt động khoa'),
                                            );
                                          }
                                        },
                                      });
                                    },
                                  }
                                : {
                                    key: 'activate',
                                    icon: <CheckCircleOutlined className="text-emerald-500" />,
                                    label: <span className="text-emerald-600">Kích hoạt lại</span>,
                                    onClick: () => {
                                      Modal.confirm({
                                        title: 'Kích hoạt lại khoa?',
                                        content: 'Khoa sẽ trở lại trạng thái Đang hoạt động.',
                                        okText: 'Kích hoạt lại',
                                        onOk: async () => {
                                          try {
                                            await organizationApi.khoas.update(r._id, { isActive: true });
                                            message.success('Đã kích hoạt lại');
                                            loadKhoas();
                                          } catch (err) {
                                            message.error(
                                              getApiErrorMessage(err, 'Không thể kích hoạt lại khoa'),
                                            );
                                          }
                                        },
                                      });
                                    },
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
            ),
          },
          {
            key: 'bo-mon',
            label: selectedKhoa ? `Bộ môn — ${selectedKhoa.name}` : 'Bộ môn',
            children: (
              <Card
                className="org-card-stack-header border border-[var(--app-border)] shadow-none rounded-xl"
                title={
                  <div className="flex flex-col gap-2 py-0.5">
                    <span className="whitespace-normal break-words leading-snug">
                      {selectedKhoa ? `Danh sách bộ môn — ${selectedKhoa.name}` : 'Danh sách bộ môn'}
                    </span>
                    <Space wrap size={[8, 8]}>
                      <DownloadExcelTemplateButton
                        kind="bo-mon"
                        size="small"
                        khoaName={selectedKhoa?.name}
                      />
                      <ImportExcelButton
                        size="small"
                        guard={() =>
                          !selectedKhoa ? 'Vui lòng chọn khoa trước khi import bộ môn' : null
                        }
                        onImport={(file) => {
                          if (!selectedKhoa) {
                            return Promise.reject(new Error('Vui lòng chọn khoa trước khi import bộ môn'));
                          }
                          return organizationApi.boMons.import(file, { khoaId: selectedKhoa._id });
                        }}
                        onDone={loadBoMons}
                      />
                      <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateBoMonModal}>
                        Thêm
                      </Button>
                    </Space>
                  </div>
                }
              >
                <Space wrap className="mb-3 w-full">
                  <Select
                    placeholder="Chọn khoa"
                    style={{ width: 280 }}
                    allowClear
                    value={selectedKhoa?._id}
                    onChange={(id) => {
                      const khoa = khoas.find((k) => k._id === id) ?? null;
                      setSelectedKhoa(khoa);
                    }}
                    options={khoas.map((k) => ({ value: k._id, label: `${k.code} — ${k.name}` }))}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="Tìm bộ môn..."
                    style={{ width: 240 }}
                    value={searchBoMon}
                    onChange={(e) => setSearchBoMon(e.target.value)}
                    allowClear
                    disabled={!selectedKhoa}
                  />
                </Space>
                <p className="text-xs text-[var(--app-text-muted)] mb-2">
                  Import/Thêm bộ môn: cần chọn khoa. File cần cột <strong>Tên khoa</strong> +{' '}
                  <strong>Tên bộ môn</strong> (nút Tải mẫu đã điền sẵn tên khoa đang chọn).
                </p>
                {!selectedKhoa ? (
                  <p className="text-sm text-[var(--app-text-muted)] py-8 text-center">
                    Chọn khoa để xem danh sách bộ môn.
                  </p>
                ) : (
                  <ResponsiveTable
                    rowKey="_id"
                    size="small"
                    loading={loadingBoMon}
                    dataSource={boMons}
                    pagination={false}
                    topScrollbar={false}
                    scroll={false}
                    tableLayout="fixed"
                    locale={{ emptyText: 'Chưa có bộ môn' }}
                    columns={[
                      { title: 'Mã', dataIndex: 'code', width: '18%', ellipsis: true },
                      { title: 'Tên bộ môn', dataIndex: 'name', width: '42%', ellipsis: true },
                      {
                        title: 'Trạng thái',
                        width: '20%',
                        render: (_: unknown, r: BoMon) => <ActivityStatusTag active={r.isActive} />,
                      },
                      {
                        title: 'Thao tác',
                        width: '20%',
                        render: (_, r) => (
                          <Dropdown.Button
                            size="small"
                            icon={<DownOutlined />}
                            onClick={(e) => {
                              e.stopPropagation();
                              boMonForm.setFieldsValue(r);
                              setBoMonModal({ open: true, editing: r });
                            }}
                            menu={{
                              onClick: ({ domEvent }) => domEvent.stopPropagation(),
                              items: [
                                r.isActive !== false
                                  ? {
                                      key: 'deactivate',
                                      icon: <DeleteOutlined className="text-red-500" />,
                                      danger: true,
                                      label: <span className="text-red-500">Ngừng hoạt động</span>,
                                      onClick: () =>
                                        Modal.confirm({
                                          title: 'Ngừng hoạt động bộ môn?',
                                          content:
                                            'Bộ môn sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
                                          okText: 'Ngừng hoạt động',
                                          okButtonProps: { danger: true },
                                          onOk: async () => {
                                            try {
                                              await organizationApi.boMons.remove(r._id);
                                              message.success('Đã chuyển sang ngừng hoạt động');
                                              loadBoMons();
                                            } catch (err) {
                                              message.error(
                                                getApiErrorMessage(err, 'Không thể ngừng hoạt động bộ môn'),
                                              );
                                            }
                                          },
                                        }),
                                    }
                                  : {
                                      key: 'activate',
                                      icon: <CheckCircleOutlined className="text-emerald-500" />,
                                      label: <span className="text-emerald-600">Kích hoạt lại</span>,
                                      onClick: () =>
                                        Modal.confirm({
                                          title: 'Kích hoạt lại bộ môn?',
                                          content: 'Bộ môn sẽ trở lại trạng thái Đang hoạt động.',
                                          okText: 'Kích hoạt lại',
                                          onOk: async () => {
                                            try {
                                              await organizationApi.boMons.update(r._id, { isActive: true });
                                              message.success('Đã kích hoạt lại');
                                              loadBoMons();
                                            } catch (err) {
                                              message.error(
                                                getApiErrorMessage(err, 'Không thể kích hoạt lại bộ môn'),
                                              );
                                            }
                                          },
                                        }),
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
                )}
              </Card>
            ),
          },
        ]}
      />

      <Modal
        open={khoaModal.open}
        title={khoaModal.editing ? 'Sửa khoa' : 'Thêm khoa'}
        onCancel={() => setKhoaModal({ open: false })}
        onOk={confirmSaveKhoa}
        okText="Lưu"
        keyboard={false}
      >
        <Form form={khoaForm} layout="vertical">
          <Form.Item
            name="code"
            label="Mã khoa"
          >
            <Input
              disabled
              placeholder="Nhập tên khoa để xem mã"
              maxLength={KHOA_CODE_MAX_LENGTH}
            />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên khoa"
            rules={[
              { required: true, message: 'Vui lòng nhập tên khoa' },
              noWhitespaceOnlyRule,
              khoaMaxLengthRule,
              khoaNamePatternRule,
            ]}
          >
            <Input maxLength={KHOA_FIELD_MAX_LENGTH} onPressEnter={handleKhoaEnterSave} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={boMonModal.open}
        title={boMonModal.editing ? 'Sửa bộ môn' : 'Thêm bộ môn'}
        onCancel={() => setBoMonModal({ open: false })}
        onOk={confirmSaveBoMon}
        okText="Lưu"
        keyboard={false}
      >
        <Form form={boMonForm} layout="vertical">
          <Form.Item
            name="code"
            label="Mã bộ môn"
          >
            <Input disabled placeholder="Nhập tên bộ môn để xem mã" />
          </Form.Item>
          <Form.Item name="name" label="Tên bộ môn" rules={[{ required: true }]}>
            <Input onPressEnter={handleBoMonEnterSave} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
