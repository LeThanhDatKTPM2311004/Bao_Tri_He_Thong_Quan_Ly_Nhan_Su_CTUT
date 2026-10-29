import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Switch } from 'antd';
import { ROLES, USER_ROLE_OPTIONS } from '@/shared/constants/roles';
import { ctutEmailRule, standardEmailRule } from '@/shared/utils/ctutEmail';
import { normalizePhoneInput, optionalPhoneRule, PHONE_MAX_LENGTH } from '@/shared/utils/phoneInput';
import { organizationApi } from '@/features/organization/services/organizationApi';
import type { BoMon, Khoa, Lop } from '@/features/organization/types/organization.types';
import { previewGiangVienMa, previewSinhVienMa } from '@/features/organization/utils/orgCodePreview';
import type { UserListItem } from '../types/users.types';

interface UserFormModalProps {
  open: boolean;
  onCancel: () => void;
  onSave: (values: any) => void;
  editingUser: UserListItem | null;
  submitting: boolean;
}

/** Hiệu trưởng / Phó hiệu trưởng thuộc cấp trường — không gắn khoa/bộ môn */
const isSchoolLevelRole = (role?: string) =>
  role === ROLES.PRINCIPAL || role === ROLES.VICE_PRINCIPAL;

/** Trưởng khoa / Phó trưởng khoa / Trợ lý khoa — chỉ cần khoa, không cần bộ môn */
const isFacultyLevelRole = (role?: string) =>
  role === ROLES.FACULTY_MANAGER ||
  role === ROLES.DEPUTY_FACULTY_MANAGER ||
  role === ROLES.KHOA_ASSISTANT;

/** Trưởng bộ môn / Phó trưởng bộ môn — bắt buộc khoa và bộ môn */
const isDepartmentLevelRole = (role?: string) =>
  role === ROLES.DEPARTMENT_CHAIR || role === ROLES.DEPUTY_DEPARTMENT_CHAIR;

/** Phòng / Trung tâm / Hành chính / Trợ lý phòng-TT — nhập đơn vị, không gắn khoa/bộ môn */
const isOfficeLevelRole = (role?: string) =>
  role === ROLES.DEPARTMENT_HEAD ||
  role === ROLES.DEPUTY_DEPARTMENT_HEAD ||
  role === ROLES.CENTER_DIRECTOR ||
  role === ROLES.DEPUTY_CENTER_DIRECTOR ||
  role === ROLES.PHONG_ASSISTANT ||
  role === ROLES.TRUNG_TAM_ASSISTANT ||
  role === ROLES.OFFICE_STAFF;

export function UserFormModal({ open, onCancel, onSave, editingUser, submitting }: UserFormModalProps) {
  const [form] = Form.useForm();
  const selectedRole = Form.useWatch('role', form);
  const khoaId = Form.useWatch('khoaId', form);
  const boMonId = Form.useWatch('boMonId', form);
  const lopId = Form.useWatch('lopId', form);
  const [khoas, setKhoas] = useState<Khoa[]>([]);
  const [boMons, setBoMons] = useState<BoMon[]>([]);
  const [lops, setLops] = useState<Lop[]>([]);
  const [existingGvCodes, setExistingGvCodes] = useState<string[]>([]);
  const [existingSvCodes, setExistingSvCodes] = useState<string[]>([]);

  const schoolLevel = isSchoolLevelRole(selectedRole);
  const facultyLevel = isFacultyLevelRole(selectedRole);
  const departmentLevel = isDepartmentLevelRole(selectedRole);
  const officeLevel = isOfficeLevelRole(selectedRole);
  const isStudent = selectedRole === ROLES.STUDENT;
  const isLecturer = selectedRole === ROLES.LECTURER;
  const showKhoaBoMon = Boolean(selectedRole) && !schoolLevel && !officeLevel;
  const showBoMon = showKhoaBoMon && !facultyLevel;
  const showPhongBan = officeLevel;
  const showLopStudent = isStudent;

  useEffect(() => {
    if (open) organizationApi.khoas.all().then((r) => setKhoas(r.data.data));
  }, [open]);

  useEffect(() => {
    if (!khoaId || schoolLevel || facultyLevel || officeLevel) {
      setBoMons([]);
      return;
    }
    organizationApi.boMons.list({ khoaId, limit: 200 }).then((r) => setBoMons(r.data.data));
  }, [khoaId, schoolLevel, facultyLevel, officeLevel]);

  useEffect(() => {
    if (schoolLevel || facultyLevel || officeLevel || !isStudent) {
      setLops([]);
      return;
    }
    if (!boMonId) {
      setLops([]);
      return;
    }
    organizationApi.lops.list({ boMonId, limit: 200 }).then((r) => setLops(r.data.data));
  }, [boMonId, schoolLevel, facultyLevel, officeLevel, isStudent]);

  useEffect(() => {
    if (!open || editingUser) return;
    if (isLecturer && khoaId) {
      organizationApi.giangViens
        .list({ khoaId, limit: 500, isActive: 'all' })
        .then((r) => setExistingGvCodes(r.data.data.map((g) => g.maGV)))
        .catch(() => setExistingGvCodes([]));
    } else {
      setExistingGvCodes([]);
    }
  }, [open, editingUser, isLecturer, khoaId]);

  useEffect(() => {
    if (!open || editingUser) return;
    if (isStudent && lopId) {
      organizationApi.sinhViens
        .list({ lopId, limit: 500, isActive: 'all' })
        .then((r) => setExistingSvCodes(r.data.data.map((s) => s.maSV)))
        .catch(() => setExistingSvCodes([]));
    } else {
      setExistingSvCodes([]);
    }
  }, [open, editingUser, isStudent, lopId]);

  useEffect(() => {
    if (!open || editingUser) return;
    if (isLecturer) {
      const khoa = khoas.find((k) => k._id === khoaId);
      form.setFieldValue('maGV', previewGiangVienMa(khoa?.code, existingGvCodes));
    }
  }, [open, editingUser, isLecturer, khoaId, khoas, existingGvCodes, form]);

  useEffect(() => {
    if (!open || editingUser) return;
    if (isStudent) {
      const lop = lops.find((l) => l._id === lopId);
      form.setFieldValue('studentId', previewSinhVienMa(lop?.code, existingSvCodes));
    }
  }, [open, editingUser, isStudent, lopId, lops, existingSvCodes, form]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      if (editingUser) {
        form.setFieldsValue({
          fullName: editingUser.fullName,
          email: editingUser.email,
          role: editingUser.role === ROLES.ACADEMIC_ADVISOR ? ROLES.LECTURER : editingUser.role,
          department: editingUser.department || '',
          faculty: editingUser.faculty || '',
          khoaId: editingUser.khoaId,
          boMonId: editingUser.boMonId,
          lopId: editingUser.lopId,
          studentId: editingUser.studentId || '',
          phone: editingUser.phone || '',
          isActive: editingUser.isActive,
        });

        if (
          (editingUser.role === ROLES.LECTURER || editingUser.role === ROLES.ACADEMIC_ADVISOR) &&
          editingUser.giangVienId
        ) {
          try {
            const gvRes = await organizationApi.giangViens.list({ limit: 500 });
            const gv = gvRes.data.data.find((item) => item._id === editingUser.giangVienId);
            if (gv) {
              form.setFieldsValue({
                maGV: gv.maGV,
                khoaId: typeof gv.khoaId === 'object' ? gv.khoaId?._id : gv.khoaId || editingUser.khoaId,
                boMonId: typeof gv.boMonId === 'object' ? gv.boMonId?._id : gv.boMonId || editingUser.boMonId,
              });
            }
          } catch {
            // bỏ qua
          }
        }
      } else {
        form.resetFields();
        form.setFieldsValue({ isActive: true });
      }
    };

    void load();
  }, [open, editingUser, form]);

  useEffect(() => {
    if (!open) return;
    const email = form.getFieldValue('email');
    if (email) {
      form.validateFields(['email']).catch(() => undefined);
    } else {
      form.setFields([{ name: 'email', errors: [] }]);
    }
  }, [selectedRole, open, form]);

  useEffect(() => {
    if (!open || !schoolLevel) return;
    form.setFieldsValue({
      khoaId: undefined,
      boMonId: undefined,
      lopId: undefined,
      faculty: '',
      department: '',
    });
  }, [schoolLevel, open, form]);

  useEffect(() => {
    if (!open || !facultyLevel) return;
    form.setFieldsValue({
      boMonId: undefined,
      lopId: undefined,
      department: '',
    });
  }, [facultyLevel, open, form]);

  useEffect(() => {
    if (!open || !officeLevel) return;
    form.setFieldsValue({
      khoaId: undefined,
      boMonId: undefined,
      lopId: undefined,
      faculty: '',
    });
  }, [officeLevel, open, form]);

  const withOrgNames = (values: {
    khoaId?: string;
    boMonId?: string;
    faculty?: string;
    department?: string;
  }) => {
    const khoa = khoas.find((k) => k._id === values.khoaId);
    const boMon = boMons.find((b) => b._id === values.boMonId);
    return {
      ...values,
      faculty: khoa?.name || '',
      department: boMon?.name || '',
    };
  };

  const handleSubmit = () => {
    form
      .validateFields()
      .then((values) => {
        if (isSchoolLevelRole(values.role)) {
          onSave({
            ...values,
            khoaId: null,
            boMonId: null,
            lopId: null,
            faculty: '',
            department: '',
          });
          return;
        }
        if (isFacultyLevelRole(values.role)) {
          const khoa = khoas.find((k) => k._id === values.khoaId);
          onSave({
            ...values,
            boMonId: null,
            lopId: null,
            department: '',
            faculty: khoa?.name || '',
          });
          return;
        }
        if (isOfficeLevelRole(values.role)) {
          onSave({
            ...values,
            khoaId: null,
            boMonId: null,
            lopId: null,
            faculty: '',
            department: String(values.department || '').trim(),
          });
          return;
        }
        if (values.role === ROLES.LECTURER) {
          onSave({
            ...withOrgNames(values),
            lopId: null,
            studentId: undefined,
            maGV: undefined,
          });
          return;
        }
        if (values.role === ROLES.STUDENT) {
          onSave({
            ...withOrgNames(values),
            studentId: undefined,
            maGV: undefined,
          });
          return;
        }
        onSave({ ...withOrgNames(values), maGV: undefined, studentId: undefined });
      })
      .catch((info) => {
        console.log('Validate Failed:', info);
      });
  };

  const emailRules = [
    { required: true, message: 'Vui lòng nhập Email' },
    { type: 'email' as const, message: 'Email không đúng định dạng' },
    isStudent ? ctutEmailRule : standardEmailRule,
  ];

  return (
    <Modal
      open={open}
      title={
        <span className="text-base font-semibold text-[var(--app-text)]">
          {editingUser ? 'Cập nhật tài khoản' : 'Thêm tài khoản mới'}
        </span>
      }
      okText={editingUser ? 'Cập nhật' : 'Thêm mới'}
      cancelText="Hủy bỏ"
      onCancel={onCancel}
      onOk={handleSubmit}
      confirmLoading={submitting}
      destroyOnClose
      okButtonProps={{ className: 'bg-blue-600 font-bold' }}
      cancelButtonProps={{ className: 'font-semibold' }}
      className="dark:bg-slate-900"
      width={520}
    >
      <Form
        form={form}
        layout="vertical"
        name="userForm"
        className="pt-4"
        initialValues={{ isActive: true }}
      >
        <Form.Item
          name="fullName"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Họ và tên</span>}
          rules={[{ required: true, message: 'Vui lòng nhập họ và tên' }]}
        >
          <Input
            placeholder="Ví dụ: Nguyễn Văn A"
            className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </Form.Item>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Form.Item
            name="role"
            label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Vai trò hệ thống</span>}
            rules={[{ required: true, message: 'Vui lòng chọn vai trò' }]}
          >
            <Select
              placeholder="Chọn vai trò"
              className="h-10 rounded-lg"
              options={USER_ROLE_OPTIONS}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Số điện thoại</span>}
            normalize={normalizePhoneInput}
            rules={[optionalPhoneRule]}
          >
            <Input
              placeholder="0901234567"
              maxLength={PHONE_MAX_LENGTH}
              inputMode="numeric"
              className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </Form.Item>
        </div>

        <Form.Item
          key={`email-rule-${isStudent ? 'student' : 'staff'}`}
          name="email"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Địa chỉ Email</span>}
          dependencies={['role']}
          rules={emailRules}
          extra={
            isStudent
              ? 'Sinh viên phải dùng email @student.ctuet.edu.vn. Hồ sơ chi tiết quản lý tại Lớp & Sinh viên; các trường cơ bản (họ tên, email, SĐT, mã SV, lớp) đồng bộ tự động.'
              : isLecturer
                ? 'Sẽ tự tạo/cập nhật hồ sơ trên trang Giảng viên (cùng email)'
                : schoolLevel
                  ? 'Cấp trường — không cần gắn khoa / bộ môn'
                  : facultyLevel
                    ? selectedRole === ROLES.KHOA_ASSISTANT
                      ? 'Trợ lý khoa — chỉ theo dõi đơn đúng khoa được chọn'
                      : 'Cấp khoa — chỉ cần chọn khoa, không cần bộ môn'
                    : officeLevel
                      ? selectedRole === ROLES.PHONG_ASSISTANT
                        ? 'Trợ lý phòng — nhập đúng tên phòng (khớp bước quy trình)'
                        : selectedRole === ROLES.TRUNG_TAM_ASSISTANT
                          ? 'Trợ lý trung tâm — nhập đúng tên trung tâm (khớp bước quy trình)'
                          : 'Cấp phòng ban — nhập tên phòng/trung tâm, không gắn khoa / bộ môn'
                      : 'Các vai trò khác dùng email thông thường (vd Gmail)'
          }
        >
          <Input
            placeholder={isStudent ? 'vidu@student.ctuet.edu.vn' : 'vidu@gmail.com'}
            disabled={!!editingUser}
            className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
          />
        </Form.Item>

        {isStudent && (
          <Form.Item
            name="studentId"
            label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Mã sinh viên</span>}
          >
            <Input
              disabled
              placeholder="Chọn lớp để xem mã"
              className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </Form.Item>
        )}

        {showPhongBan && (
          <Form.Item
            name="department"
            label={
              <span className="text-[var(--app-text-muted)] font-semibold text-xs">
                {selectedRole === ROLES.CENTER_DIRECTOR ||
                selectedRole === ROLES.DEPUTY_CENTER_DIRECTOR ||
                selectedRole === ROLES.TRUNG_TAM_ASSISTANT
                  ? 'Trung tâm'
                  : 'Phòng / đơn vị'}
              </span>
            }
            rules={[
              {
                required: true,
                message:
                  selectedRole === ROLES.TRUNG_TAM_ASSISTANT ||
                  selectedRole === ROLES.CENTER_DIRECTOR ||
                  selectedRole === ROLES.DEPUTY_CENTER_DIRECTOR
                    ? 'Vui lòng nhập đúng tên trung tâm'
                    : 'Vui lòng nhập đúng tên phòng',
              },
            ]}
            extra={
              selectedRole === ROLES.PHONG_ASSISTANT ||
              selectedRole === ROLES.TRUNG_TAM_ASSISTANT
                ? 'Phải trùng tên đơn vị gắn trên bước ký của trưởng phòng / giám đốc trong quy trình.'
                : undefined
            }
          >
            <Input
              placeholder={
                selectedRole === ROLES.TRUNG_TAM_ASSISTANT ||
                selectedRole === ROLES.CENTER_DIRECTOR ||
                selectedRole === ROLES.DEPUTY_CENTER_DIRECTOR
                  ? 'Ví dụ: Trung tâm Công nghệ Thông tin'
                  : 'Ví dụ: Phòng Đào tạo, Phòng CTCTSV...'
              }
              className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </Form.Item>
        )}

        {isLecturer && (
          <Form.Item
            name="maGV"
            label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Mã giảng viên</span>}
          >
            <Input
              disabled
              placeholder="Chọn khoa để xem mã"
              maxLength={15}
              className="h-10 rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white"
            />
          </Form.Item>
        )}

        {showKhoaBoMon && (
          <div className={`grid grid-cols-1 ${showBoMon ? 'sm:grid-cols-2' : ''} gap-4`}>
            <Form.Item
              name="khoaId"
              label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Khoa</span>}
              rules={
                isLecturer || isStudent || facultyLevel || departmentLevel
                  ? [
                      {
                        required: true,
                        message:
                          selectedRole === ROLES.KHOA_ASSISTANT
                            ? 'Trợ lý phải chọn đúng khoa phụ trách'
                            : 'Vui lòng chọn khoa',
                      },
                    ]
                  : undefined
              }
              extra={
                selectedRole === ROLES.KHOA_ASSISTANT
                  ? 'Chỉ xem/theo dõi đơn sinh viên thuộc khoa này.'
                  : undefined
              }
            >
              <Select
                allowClear={!(isLecturer || isStudent || facultyLevel || departmentLevel)}
                placeholder="Chọn khoa"
                options={khoas.map((k) => ({ value: k._id, label: k.name }))}
                onChange={() => {
                  form.setFieldValue('boMonId', undefined);
                  form.setFieldValue('lopId', undefined);
                }}
              />
            </Form.Item>
            {showBoMon && (
              <Form.Item
                name="boMonId"
                label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Bộ môn</span>}
                rules={
                  isLecturer || isStudent || departmentLevel
                    ? [{ required: true, message: 'Vui lòng chọn bộ môn' }]
                    : undefined
                }
                extra={
                  departmentLevel
                    ? 'Trưởng bộ môn và phó trưởng bộ môn chỉ nhận hồ sơ đúng bộ môn này.'
                    : undefined
                }
              >
                <Select
                  allowClear={!(isLecturer || isStudent || departmentLevel)}
                  placeholder="Chọn bộ môn"
                  disabled={!khoaId}
                  options={boMons.map((b) => ({ value: b._id, label: b.name }))}
                  onChange={() => form.setFieldValue('lopId', undefined)}
                />
              </Form.Item>
            )}
          </div>
        )}

        {showLopStudent && (
          <Form.Item
            name="lopId"
            label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Lớp</span>}
            rules={[{ required: true, message: 'Vui lòng chọn lớp để đồng bộ hồ sơ sinh viên' }]}
            extra="Bắt buộc — tạo/cập nhật hồ sơ tại Lớp & Sinh viên cùng các trường cơ bản trên form này"
          >
            <Select
              placeholder="Chọn lớp"
              disabled={!boMonId}
              options={lops.map((l) => ({ value: l._id, label: `${l.code} — ${l.name}` }))}
            />
          </Form.Item>
        )}

        <Form.Item
          name="isActive"
          label={<span className="text-[var(--app-text-muted)] font-semibold text-xs">Trạng thái hoạt động</span>}
          valuePropName="checked"
          className="mb-0"
        >
          <Switch checkedChildren="Hoạt động" unCheckedChildren="Bị khóa" className="bg-slate-300 dark:bg-slate-700" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
