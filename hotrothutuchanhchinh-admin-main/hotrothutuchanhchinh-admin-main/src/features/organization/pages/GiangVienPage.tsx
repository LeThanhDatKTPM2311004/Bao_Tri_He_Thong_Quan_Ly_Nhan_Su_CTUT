import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Card, Button, Input, Space, Modal, Form, Select, message, Descriptions, Tag, Dropdown } from 'antd';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  EyeOutlined,
  DownOutlined,
  TeamOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { getApiErrorMessage } from '@/shared/utils/getApiErrorMessage';
import { standardEmailRule } from '@/shared/utils/ctutEmail';
import { normalizePhoneInput, optionalPhoneRule, PHONE_MAX_LENGTH } from '@/shared/utils/phoneInput';
import { noWhitespaceOnlyRule } from '@/shared/utils/formInput';
import { organizationApi } from '../services/organizationApi';
import { ImportExcelButton } from '../components/ImportExcelButton';
import { DownloadExcelTemplateButton } from '../components/DownloadExcelTemplateButton';
import { refName, type BoMon, type GiangVien, type GiangVienQuyen, type Khoa, type Lop, type Quyen } from '../types/organization.types';
import { GV_CODE_MAX_LENGTH, GV_FIELD_MAX_LENGTH, gvNameMaxLengthRule, gvNamePatternRule } from '../constants/giangVienValidation';
import { createOrgEmailDuplicateRule } from '../constants/organizationValidation';
import { loadAllOrgEmails as fetchAllOrgEmails } from '../utils/orgEmails';
import { previewGiangVienMa } from '../utils/orgCodePreview';

export function GiangVienPage() {
  const [khoas, setKhoas] = useState<Khoa[]>([]);
  const [boMons, setBoMons] = useState<BoMon[]>([]);
  const [giangViens, setGiangViens] = useState<GiangVien[]>([]);
  const [gvQuyens, setGvQuyens] = useState<GiangVienQuyen[]>([]);
  const [lopsForAdvisor, setLopsForAdvisor] = useState<Lop[]>([]);
  const [khoaId, setKhoaId] = useState<string>();
  const [boMonId, setBoMonId] = useState<string>();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; editing?: GiangVien }>({ open: false });
  const [detailModal, setDetailModal] = useState<{ open: boolean; gv?: GiangVien }>({ open: false });
  const [detailQuyens, setDetailQuyens] = useState<GiangVienQuyen[]>([]);
  const [quyenModal, setQuyenModal] = useState<{ open: boolean; gv?: GiangVien }>({ open: false });
  const [form] = Form.useForm();
  const [quyenForm] = Form.useForm();
  const [allGvCodes, setAllGvCodes] = useState<string[]>([]);
  const [allOrgEmails, setAllOrgEmails] = useState<string[]>([]);
  const formKhoaId = Form.useWatch('khoaId', form);
  const formBoMonId = Form.useWatch('boMonId', form);

  useEffect(() => {
    if (!modal.open || modal.editing) return;
    const khoa = khoas.find((k) => k._id === formKhoaId);
    form.setFieldValue('maGV', previewGiangVienMa(khoa?.code, allGvCodes));
  }, [modal.open, modal.editing, formKhoaId, khoas, allGvCodes, form]);

  useEffect(() => {
    organizationApi.khoas
      .all()
      .then((r) => {
        setKhoas(r.data.data);
        // Mặc định không lọc khoa → hiện tất cả giảng viên
      })
      .catch((err) => message.error(getApiErrorMessage(err, 'Không tải được danh sách khoa')));
  }, []);

  useEffect(() => {
    if (!khoaId) {
      setBoMons([]);
      setBoMonId(undefined);
      return;
    }
    organizationApi.boMons
      .list({ khoaId, limit: 200 })
      .then((r) => {
        const list = r.data.data;
        setBoMons(list);
        // Chỉ giữ bộ môn đang chọn nếu còn thuộc khoa; không tự chọn bộ môn mặc định
        setBoMonId((prev) => (prev && list.some((b) => b._id === prev) ? prev : undefined));
      })
      .catch((err) => message.error(getApiErrorMessage(err, 'Không tải được danh sách bộ môn')));
  }, [khoaId]);

  const handleKhoaChange = (value?: string) => {
    setKhoaId(value);
    setBoMonId(undefined);
  };

  const loadGiangViens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await organizationApi.giangViens.list({
        khoaId,
        boMonId,
        search: search || undefined,
        limit: 200,
        isActive: 'all',
      });
      const list = res.data.data;
      setGiangViens(list);
      setQuyenModal((prev) => {
        if (!prev.open || !prev.gv) return prev;
        const fresh = list.find((g) => g._id === prev.gv!._id);
        return fresh ? { ...prev, gv: fresh } : prev;
      });
      setDetailModal((prev) => {
        if (!prev.open || !prev.gv) return prev;
        const fresh = list.find((g) => g._id === prev.gv!._id);
        return fresh ? { ...prev, gv: fresh } : prev;
      });
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được danh sách giảng viên'));
    } finally {
      setLoading(false);
    }
  }, [khoaId, boMonId, search]);

  useEffect(() => { loadGiangViens(); }, [loadGiangViens]);

  const loadAllGvCodes = useCallback(async () => {
    const res = await organizationApi.giangViens.list({ limit: 500, isActive: 'all' });
    setAllGvCodes(res.data.data.map((gv) => gv.maGV.toUpperCase()));
  }, []);

  const refreshOrgEmails = useCallback(async () => {
    setAllOrgEmails(await fetchAllOrgEmails());
  }, []);

  const loadLopsForAdvisor = useCallback(async (selectedKhoaId?: string, selectedBoMonId?: string) => {
    if (!selectedKhoaId && !selectedBoMonId) {
      setLopsForAdvisor([]);
      return;
    }
    const res = await organizationApi.lops.list({
      khoaId: selectedKhoaId,
      boMonId: selectedBoMonId,
      limit: 500,
    });
    setLopsForAdvisor(res.data.data);
  }, []);

  useEffect(() => {
    if (!modal.open) return;
    void loadLopsForAdvisor(formKhoaId || khoaId, formBoMonId || boMonId);
  }, [modal.open, formKhoaId, formBoMonId, khoaId, boMonId, loadLopsForAdvisor]);

  useEffect(() => {
    if (!quyenModal.open || !quyenModal.gv) return;
    const gv = quyenModal.gv;
    const gvKhoaId = typeof gv.khoaId === 'object' ? gv.khoaId?._id : gv.khoaId;
    const gvBoMonId = typeof gv.boMonId === 'object' ? gv.boMonId?._id : gv.boMonId;
    void loadLopsForAdvisor(gvKhoaId, gvBoMonId);
    quyenForm.setFieldsValue({
      lopCoVanIds: (gv.lopCoVans || []).map((l) => l._id),
    });
  }, [quyenModal.open, quyenModal.gv, loadLopsForAdvisor, quyenForm]);

  const openCreateGvModal = () => {
    form.resetFields();
    form.setFieldsValue({ khoaId, boMonId, lopCoVanIds: [] });
    void loadAllGvCodes();
    void refreshOrgEmails();
    setModal({ open: true });
  };

  const openEditGvModal = (gv: GiangVien) => {
    form.setFieldsValue({
      ...gv,
      khoaId: typeof gv.khoaId === 'object' ? gv.khoaId._id : gv.khoaId,
      boMonId: typeof gv.boMonId === 'object' ? gv.boMonId._id : gv.boMonId,
      lopCoVanIds: (gv.lopCoVans || []).map((l) => l._id),
    });
    void loadAllGvCodes();
    void refreshOrgEmails();
    setModal({ open: true, editing: gv });
  };

  const loadGvQuyens = async (giangVienId: string) => {
    try {
      const res = await organizationApi.giangVienQuyens.list({ giangVienId, limit: 50 });
      setGvQuyens(res.data.data);
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được quyền của giảng viên'));
    }
  };

  const openDetailGv = async (gv: GiangVien) => {
    setDetailModal({ open: true, gv });
    setDetailQuyens([]);
    try {
      const res = await organizationApi.giangVienQuyens.list({ giangVienId: gv._id, limit: 50 });
      setDetailQuyens(res.data.data.filter((item) => item.isActive !== false));
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không tải được quyền của giảng viên'));
    }
  };

  const formatQuyenScope = (item: GiangVienQuyen) => {
    const quyenName = refName(item.quyenId as Quyen);
    const khoaName = refName(item.khoaId as Khoa);
    const boMonName = refName(item.boMonId as BoMon);
    const scopeParts = [khoaName !== '—' ? khoaName : null, boMonName !== '—' ? boMonName : null].filter(Boolean);
    return scopeParts.length ? `${quyenName} (${scopeParts.join(' / ')})` : quyenName;
  };

  const handleSaveGv = async (values: {
    maGV: string;
    fullName: string;
    email?: string;
    phone?: string;
    khoaId?: string;
    boMonId?: string;
    lopCoVanIds?: string[];
  }) => {
    try {
      const payload: Partial<GiangVien> & { lopCoVanIds?: string[] } = {
        ...values,
        khoaId: values.khoaId || khoaId,
        boMonId: values.boMonId || boMonId,
        lopCoVanIds: values.lopCoVanIds || [],
      };
      if (modal.editing) {
        await organizationApi.giangViens.update(modal.editing._id, payload);
      } else {
        await organizationApi.giangViens.create(payload);
      }
      message.success('Lưu thành công');
      setModal({ open: false });
      loadGiangViens();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) {
        throw err;
      }
      message.error(getApiErrorMessage(err, 'Không thể lưu thông tin giảng viên'));
      throw err;
    }
  };

  const confirmSaveGv = () =>
    form
      .validateFields()
      .then(handleSaveGv)
      .catch((err) => Promise.reject(err));

  const handleGvEnterSave = (event: KeyboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    void confirmSaveGv();
  };

  const saveLopCoVanFromQuyenModal = async () => {
    if (!quyenModal.gv) return;
    try {
      const values = await quyenForm.validateFields(['lopCoVanIds']);
      await organizationApi.giangViens.update(quyenModal.gv._id, {
        lopCoVanIds: values.lopCoVanIds || [],
      } as Partial<GiangVien> & { lopCoVanIds?: string[] });
      message.success('Đã cập nhật lớp cố vấn (đồng bộ quyền Cố vấn học tập)');
      await loadGvQuyens(quyenModal.gv._id);
      await loadGiangViens();
    } catch (err) {
      if ((err as { errorFields?: unknown }).errorFields) return;
      message.error(getApiErrorMessage(err, 'Không thể cập nhật lớp cố vấn'));
    }
  };

  const revokeQuyen = async (assignmentId: string) => {
    try {
      await organizationApi.giangVienQuyens.revoke(assignmentId);
      message.success('Đã thu hồi quyền');
      if (quyenModal.gv) {
        await loadGvQuyens(quyenModal.gv._id);
        await loadGiangViens();
      }
    } catch (err) {
      message.error(getApiErrorMessage(err, 'Không thể thu hồi quyền'));
    }
  };

  const toggleGiangVienActive = (gv: GiangVien) => {
    const isOn = gv.isActive !== false;
    if (isOn) {
      Modal.confirm({
        title: 'Ngừng hoạt động giảng viên?',
        content:
          'Giảng viên sẽ hiển thị trạng thái Ngừng hoạt động, không bị xóa khỏi danh sách.',
        okText: 'Ngừng hoạt động',
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await organizationApi.giangViens.remove(gv._id);
            message.success('Đã chuyển sang ngừng hoạt động');
            loadGiangViens();
          } catch (err) {
            message.error(getApiErrorMessage(err, 'Không thể ngừng hoạt động giảng viên'));
            throw err;
          }
        },
      });
      return;
    }
    Modal.confirm({
      title: 'Kích hoạt lại giảng viên?',
      content: 'Giảng viên sẽ trở lại trạng thái Đang hoạt động.',
      okText: 'Kích hoạt lại',
      onOk: async () => {
        try {
          await organizationApi.giangViens.update(gv._id, { isActive: true });
          message.success('Đã kích hoạt lại');
          loadGiangViens();
        } catch (err) {
          message.error(getApiErrorMessage(err, 'Không thể kích hoạt lại giảng viên'));
          throw err;
        }
      },
    });
  };

  const advisorLopOptions = (() => {
    const map = new Map<string, { value: string; label: string }>();
    for (const lop of lopsForAdvisor) {
      map.set(lop._id, { value: lop._id, label: `${lop.code} — ${lop.name}` });
    }
    // Giữ các lớp đang gán dù nằm ngoài bộ lọc khoa/bộ môn hiện tại
    const currentLops = [
      ...(modal.editing?.lopCoVans || []),
      ...(quyenModal.gv?.lopCoVans || []),
    ];
    for (const lop of currentLops) {
      if (!map.has(lop._id)) {
        map.set(lop._id, { value: lop._id, label: `${lop.code} — ${lop.name}` });
      }
    }
    return [...map.values()];
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Quản lý Giảng viên" subtitle="Danh sách giảng viên và gán lớp cố vấn" />
      <Card className="border border-[var(--app-border)] shadow-none rounded-xl">
        <Space wrap className="mb-4">
          <Select placeholder="Lọc khoa" style={{ width: 200 }} allowClear value={khoaId} onChange={handleKhoaChange}
            options={khoas.map((k) => ({ value: k._id, label: k.name }))} />
          <Select
            key={khoaId ?? 'no-khoa'}
            placeholder="Lọc bộ môn"
            style={{ width: 200 }}
            allowClear
            value={boMonId}
            onChange={setBoMonId}
            disabled={!khoaId}
            options={boMons.map((b) => ({ value: b._id, label: b.name }))}
          />
          <Input prefix={<SearchOutlined />} placeholder="Tìm GV..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 200 }} />
          <DownloadExcelTemplateButton
            kind="giang-vien"
            khoaName={khoas.find((k) => k._id === khoaId)?.name}
            boMonName={boMons.find((b) => b._id === boMonId)?.name}
          />
          <ImportExcelButton
            onImport={(file) => organizationApi.giangViens.import(file, { khoaId, boMonId })}
            onDone={loadGiangViens}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateGvModal}>
            Thêm giảng viên
          </Button>
        </Space>
        <p className="text-xs text-[var(--app-text-muted)] mb-3">
          Import Excel: cần cột <strong>Mã GV</strong> + <strong>Họ tên</strong> + <strong>Email</strong>.
          Cột <strong>Lớp cố vấn</strong> tùy chọn — điền <strong>mã lớp</strong> (vd HTTT20) hoặc đúng tên lớp;
          nhiều lớp cách nhau bằng dấu phẩy. Hệ thống sẽ gán lớp và đồng bộ quyền Cố vấn học tập.
          Nếu file không có cột Khoa/Bộ môn, hãy <strong>chọn Khoa và Bộ môn ở bộ lọc phía trên</strong> trước khi import.
        </p>
        <ResponsiveTable rowKey="_id" loading={loading} dataSource={giangViens} pagination={{ pageSize: 10 }}
          columns={[
            { title: 'Họ tên', dataIndex: 'fullName' },
            { title: 'Khoa', render: (_, r) => refName(r.khoaId as Khoa) },
            { title: 'Bộ môn', render: (_, r) => refName(r.boMonId as BoMon) },
            {
              title: 'Thao tác',
              width: 160,
              render: (_, r) => (
                <Dropdown.Button
                  size="small"
                  icon={<DownOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    void openDetailGv(r);
                  }}
                  menu={{
                    onClick: ({ domEvent }) => domEvent.stopPropagation(),
                    items: [
                      {
                        key: 'quyen',
                        icon: <TeamOutlined className="text-teal-500" />,
                        label: 'Gán cố vấn',
                        onClick: () => {
                          setQuyenModal({ open: true, gv: r });
                          quyenForm.setFieldsValue({
                            lopCoVanIds: (r.lopCoVans || []).map((l) => l._id),
                          });
                          loadGvQuyens(r._id);
                        },
                      },
                      {
                        key: 'edit',
                        icon: <EditOutlined className="text-amber-500" />,
                        label: 'Sửa',
                        onClick: () => openEditGvModal(r),
                      },
                      { type: 'divider' as const },
                      r.isActive !== false
                        ? {
                            key: 'deactivate',
                            icon: <DeleteOutlined className="text-red-500" />,
                            danger: true,
                            label: <span className="text-red-500">Ngừng hoạt động</span>,
                            onClick: () => toggleGiangVienActive(r),
                          }
                        : {
                            key: 'activate',
                            icon: <CheckCircleOutlined className="text-emerald-500" />,
                            label: <span className="text-emerald-600">Kích hoạt lại</span>,
                            onClick: () => toggleGiangVienActive(r),
                          },
                    ],
                  }}
                >
                  <EyeOutlined /> Chi tiết
                </Dropdown.Button>
              ),
            },
          ]} />
      </Card>

      <Modal
        open={detailModal.open}
        title={detailModal.gv ? `Chi tiết — ${detailModal.gv.fullName}` : 'Chi tiết giảng viên'}
        onCancel={() => {
          setDetailModal({ open: false });
          setDetailQuyens([]);
        }}
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setDetailModal({ open: false });
              setDetailQuyens([]);
            }}
          >
            Đóng
          </Button>,
        ]}
        width={560}
        destroyOnClose
      >
        {detailModal.gv && (
          <Descriptions bordered size="small" column={1} className="mt-2">
            <Descriptions.Item label="Mã GV">{detailModal.gv.maGV || '—'}</Descriptions.Item>
            <Descriptions.Item label="Họ tên">{detailModal.gv.fullName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Email">{detailModal.gv.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="SĐT">{detailModal.gv.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Khoa">{refName(detailModal.gv.khoaId as Khoa)}</Descriptions.Item>
            <Descriptions.Item label="Bộ môn">{refName(detailModal.gv.boMonId as BoMon)}</Descriptions.Item>
            <Descriptions.Item label="Lớp cố vấn">
              {detailModal.gv.lopCoVans?.length ? (
                <Space wrap size={[4, 4]}>
                  {detailModal.gv.lopCoVans.map((l) => (
                    <Tag key={l._id} color="cyan">
                      {l.code}
                      {l.name ? ` — ${l.name}` : ''}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            {detailQuyens.length > 0 ? (
              <Descriptions.Item label="Quyền">
                <Space wrap size={[4, 4]}>
                  {detailQuyens.map((item) => (
                    <Tag key={item._id} color="blue">
                      {formatQuyenScope(item)}
                    </Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            ) : null}
            <Descriptions.Item label="Trạng thái">
              <Tag color={detailModal.gv.isActive ? 'success' : 'default'}>
                {detailModal.gv.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        open={modal.open}
        title={modal.editing ? 'Sửa giảng viên' : 'Thêm giảng viên'}
        onCancel={() => setModal({ open: false })}
        onOk={confirmSaveGv}
        okText="Lưu"
        keyboard={false}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="maGV"
            label="Mã GV"
          >
            <Input disabled placeholder="Chọn khoa để xem mã" maxLength={GV_CODE_MAX_LENGTH} />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="Họ tên"
            rules={[
              { required: true, message: 'Vui lòng nhập họ tên' },
              noWhitespaceOnlyRule,
              gvNameMaxLengthRule,
              gvNamePatternRule,
            ]}
          >
            <Input maxLength={GV_FIELD_MAX_LENGTH} onPressEnter={handleGvEnterSave} />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Vui lòng nhập Email' },
              noWhitespaceOnlyRule,
              { type: 'email', message: 'Email không đúng định dạng' },
              standardEmailRule,
              createOrgEmailDuplicateRule(allOrgEmails, modal.editing?.email),
            ]}
          >
            <Input placeholder="vidu@gmail.com" onPressEnter={handleGvEnterSave} />
          </Form.Item>
          <Form.Item
            name="phone"
            label="SĐT"
            normalize={normalizePhoneInput}
            rules={[optionalPhoneRule]}
          >
            <Input placeholder="0901234567" maxLength={PHONE_MAX_LENGTH} inputMode="numeric" onPressEnter={handleGvEnterSave} />
          </Form.Item>
          <Form.Item name="khoaId" label="Khoa" rules={[{ required: true }]}>
            <Select options={khoas.map((k) => ({ value: k._id, label: k.name }))} onChange={(v) => {
              form.setFieldValue('khoaId', v);
              form.setFieldValue('boMonId', undefined);
              organizationApi.boMons.list({ khoaId: v, limit: 200 }).then((res) => setBoMons(res.data.data));
            }} />
          </Form.Item>
          <Form.Item name="boMonId" label="Bộ môn" rules={[{ required: true }]}>
            <Select options={boMons.map((b) => ({ value: b._id, label: b.name }))} />
          </Form.Item>
          <Form.Item
            name="lopCoVanIds"
            label="Lớp cố vấn"
            extra="Không bắt buộc."
          >
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn mã lớp (vd HTTT20 — Hệ thống thông tin20)"
              options={advisorLopOptions}
              notFoundContent={
                formKhoaId || formBoMonId || khoaId || boMonId
                  ? 'Không có lớp phù hợp — kiểm tra đã tạo lớp ở trang Lớp & Sinh viên'
                  : 'Chọn khoa/bộ môn trước để tải danh sách lớp'
              }
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={quyenModal.open}
        title={`Gán cố vấn — ${quyenModal.gv?.fullName}`}
        onCancel={() => setQuyenModal({ open: false })}
        footer={null}
        width={640}
        destroyOnClose
      >
        <Form form={quyenForm} layout="vertical" className="mb-2">
          <Form.Item name="lopCoVanIds" label="Lớp cố vấn">
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Chọn lớp cố vấn"
              options={advisorLopOptions}
            />
          </Form.Item>
          <Button type="default" className="mb-4" onClick={() => void saveLopCoVanFromQuyenModal()}>
            Lưu lớp cố vấn
          </Button>
        </Form>

        <ResponsiveTable
          rowKey="_id"
          size="small"
          dataSource={gvQuyens}
          pagination={false}
          columns={[
            { title: 'Quyền', render: (_, r) => refName(r.quyenId as Quyen) },
            { title: 'Khoa', render: (_, r) => refName(r.khoaId as Khoa) },
            { title: 'Bộ môn', render: (_, r) => refName(r.boMonId as BoMon) },
            {
              title: '',
              width: 80,
              render: (_, r) => (
                <Button size="small" danger onClick={() => void revokeQuyen(r._id)}>
                  Thu hồi
                </Button>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
