import { useEffect, useState } from 'react';
import { Modal, Form, Select, Typography } from 'antd';
import { organizationApi } from '@/features/organization/services/organizationApi';
import type { BoMon, Khoa, Lop } from '@/features/organization/types/organization.types';
import { ROLE_LABELS, type Role } from '@/shared/constants/roles';
import { usersApi } from '../services/usersApi';
import type { UserListItem } from '../types/users.types';

interface AssignAdvisorModalProps {
  open: boolean;
  user: UserListItem | null;
  submitting: boolean;
  onCancel: () => void;
  onSave: (values: {
    khoaId: string;
    boMonId: string;
    lopCoVanIds: string[];
  }) => void;
}

export function AssignAdvisorModal({
  open,
  user,
  submitting,
  onCancel,
  onSave,
}: AssignAdvisorModalProps) {
  const [form] = Form.useForm();
  const khoaId = Form.useWatch('khoaId', form);
  const boMonId = Form.useWatch('boMonId', form);
  const [khoas, setKhoas] = useState<Khoa[]>([]);
  const [boMons, setBoMons] = useState<BoMon[]>([]);
  const [lops, setLops] = useState<Lop[]>([]);
  const [loadingDuty, setLoadingDuty] = useState(false);

  useEffect(() => {
    if (open) organizationApi.khoas.all().then((r) => setKhoas(r.data.data));
  }, [open]);

  useEffect(() => {
    if (!khoaId) {
      setBoMons([]);
      return;
    }
    organizationApi.boMons.list({ khoaId, limit: 200 }).then((r) => setBoMons(r.data.data));
  }, [khoaId]);

  useEffect(() => {
    if (!khoaId && !boMonId) {
      setLops([]);
      return;
    }
    organizationApi.lops
      .list({ khoaId, boMonId, limit: 500 })
      .then((r) => setLops(r.data.data));
  }, [khoaId, boMonId]);

  useEffect(() => {
    if (!open || !user) return;

    const load = async () => {
      setLoadingDuty(true);
      form.resetFields();
      try {
        const res = await usersApi.getAdvisorDuty(user._id);
        const duty = res.data.data;
        form.setFieldsValue({
          khoaId: duty.khoaId || undefined,
          boMonId: duty.boMonId || undefined,
          lopCoVanIds: duty.lopCoVanIds || [],
        });
      } catch {
        form.setFieldsValue({
          khoaId: user.khoaId || undefined,
          boMonId: user.boMonId || undefined,
          lopCoVanIds: [],
        });
      } finally {
        setLoadingDuty(false);
      }
    };

    void load();
  }, [open, user, form]);

  const handleOk = () => {
    form
      .validateFields()
      .then((values) => {
        onSave({
          khoaId: values.khoaId,
          boMonId: values.boMonId,
          lopCoVanIds: values.lopCoVanIds || [],
        });
      })
      .catch(() => undefined);
  };

  return (
    <Modal
      open={open}
      title={
        <span className="text-base font-semibold text-[var(--app-text)]">
          Gán quyền cố vấn học tập
        </span>
      }
      okText="Lưu gán"
      cancelText="Hủy"
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={submitting || loadingDuty}
      destroyOnClose
      okButtonProps={{ className: 'bg-blue-600 font-bold' }}
      width={520}
    >
      {user && (
        <Typography.Paragraph className="text-[var(--app-text-muted)] text-sm mb-4">
          Tài khoản: <strong>{user.fullName}</strong>
          {' · '}
          Vai trò: <strong>{ROLE_LABELS[user.role as Role] || user.role}</strong>
          <br />
          <span className="text-xs text-[var(--app-text-muted)]">
            Nhiệm vụ cố vấn gắn kèm vai trò hiện tại — không đổi vai trò hệ thống.
          </span>
        </Typography.Paragraph>
      )}

      <Form form={form} layout="vertical" className="pt-1">
        <Form.Item
          name="khoaId"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Khoa</span>}
          rules={[{ required: true, message: 'Vui lòng chọn khoa' }]}
        >
          <Select
            placeholder="Chọn khoa"
            options={khoas.map((k) => ({ value: k._id, label: k.name }))}
            onChange={() => {
              form.setFieldValue('boMonId', undefined);
              form.setFieldValue('lopCoVanIds', []);
            }}
          />
        </Form.Item>

        <Form.Item
          name="boMonId"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Bộ môn</span>}
          rules={[{ required: true, message: 'Vui lòng chọn bộ môn' }]}
        >
          <Select
            placeholder="Chọn bộ môn"
            disabled={!khoaId}
            options={boMons.map((b) => ({ value: b._id, label: b.name }))}
            onChange={() => form.setFieldValue('lopCoVanIds', [])}
          />
        </Form.Item>

        <Form.Item
          name="lopCoVanIds"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Lớp cố vấn</span>}
          rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một lớp' }]}
          extra="Có thể chọn nhiều lớp thuộc khoa/bộ môn đã chọn."
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={khoaId || boMonId ? 'Chọn lớp cố vấn' : 'Chọn khoa/bộ môn trước'}
            disabled={!khoaId && !boMonId}
            options={lops.map((l) => ({ value: l._id, label: `${l.code} — ${l.name}` }))}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
