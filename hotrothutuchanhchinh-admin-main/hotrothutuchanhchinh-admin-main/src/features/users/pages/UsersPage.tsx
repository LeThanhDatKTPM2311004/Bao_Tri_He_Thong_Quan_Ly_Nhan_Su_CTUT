import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { UserTable } from '../components/UserTable';
import { UserFormModal } from '../components/UserFormModal';
import { AssignAdvisorModal } from '../components/AssignAdvisorModal';
import { Input, Button, Select, Space, message, Modal, Descriptions, Badge, Tag, Avatar } from 'antd';
import { 
  UserAddOutlined, 
  SearchOutlined, 
  SafetyCertificateOutlined,
  CheckCircleOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { ROLE_LABELS, ROLES, USER_ROLE_OPTIONS, type Role } from '@/shared/constants/roles';
import type { UserListItem } from '../types/users.types';
import { usersApi } from '../services/usersApi';
import { getErrorMessage } from '@/shared/utils/errorHandler';

const DEFAULT_PASSWORD = 'Pmtthc@123';

const getRoleTagColor = (role: Role) => {
  switch (role) {
    case 'admin': return 'red';
    case 'principal': return 'gold';
    case 'vice_principal': return 'orange';
    case 'department_head': return 'magenta';
    case 'deputy_department_head': return 'pink';
    case 'center_director': return 'magenta';
    case 'deputy_center_director': return 'pink';
    case 'office_staff': return 'default';
    case 'faculty_manager': return 'blue';
    case 'deputy_faculty_manager': return 'geekblue';
    case 'department_chair':
    case 'faculty_assistant': return 'blue';
    case 'deputy_department_chair': return 'cyan';
    case 'academic_advisor': return 'green';
    case 'lecturer': return 'blue';
    case 'student_affairs': return 'orange';
    case 'student': return 'success';
    default: return 'default';
  }
};

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  
  const [searchQuery, setSearchQuery] = useState<string>(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => searchParams.get('search') || '');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const [formModalOpen, setFormModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState<boolean>(false);
  const [viewingUser, setViewingUser] = useState<UserListItem | null>(null);
  const [viewingAdvisorLops, setViewingAdvisorLops] = useState<
    Array<{ _id: string; code: string; name: string }>
  >([]);
  const [viewingOrgScope, setViewingOrgScope] = useState<{
    khoaName: string;
    boMonName: string;
  }>({ khoaName: '', boMonName: '' });
  const [advisorModalOpen, setAdvisorModalOpen] = useState<boolean>(false);
  const [advisorUser, setAdvisorUser] = useState<UserListItem | null>(null);
  const [advisorSubmitting, setAdvisorSubmitting] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const fromUrl = searchParams.get('search') || '';
    setSearchQuery((prev) => (prev === fromUrl ? prev : fromUrl));
    setDebouncedSearch((prev) => (prev === fromUrl ? prev : fromUrl));
  }, [searchParams]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedRole !== 'all') params.role = selectedRole;
      if (selectedStatus !== 'all') params.isActive = selectedStatus === 'active';

      const response = await usersApi.getAll(params);
      setUsers(response.data.data);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể tải danh sách người dùng từ máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, selectedRole, selectedStatus]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUserClick = () => {
    setEditingUser(null);
    setFormModalOpen(true);
  };

  const handleEditUserClick = (user: UserListItem) => {
    setEditingUser(user);
    setFormModalOpen(true);
  };

  const handleViewDetailsClick = async (user: UserListItem) => {
    setViewingUser(user);
    setViewingAdvisorLops([]);
    setViewingOrgScope({
      khoaName: user.faculty || '',
      boMonName: user.department || '',
    });
    setDetailsModalOpen(true);
    if (user.role === 'student') return;
    try {
      const res = await usersApi.getAdvisorDuty(user._id);
      const duty = res.data.data;
      setViewingAdvisorLops(duty.lopCoVans || []);
      setViewingOrgScope({
        khoaName: duty.khoaName || user.faculty || '',
        boMonName: duty.boMonName || user.department || '',
      });
    } catch {
      setViewingAdvisorLops([]);
    }
  };


  const handleSaveUser = async (values: any) => {
    setSubmitting(true);
    try {
      if (editingUser) {
        await usersApi.update(editingUser._id, values);
        message.success(`Đã cập nhật thông tin tài khoản ${values.fullName} thành công.`);
      } else {
        await usersApi.create({ ...values, password: DEFAULT_PASSWORD });
        message.success(`Đã tạo tài khoản mới cho ${values.fullName}. Mật khẩu mặc định: ${DEFAULT_PASSWORD}`);
      }
      setFormModalOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Lỗi khi lưu thông tin người dùng.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: UserListItem) => {
    if (user.role === ROLES.ADMIN) {
      message.warning('Không thể thay đổi trạng thái hoạt động của tài khoản quản trị viên.');
      return;
    }

    try {
      const nextStatus = !user.isActive;
      await usersApi.toggleStatus(user._id, nextStatus);
      if (!nextStatus) {
        message.warning(`Tài khoản ${user.fullName} đã bị khóa tạm thời.`);
      } else {
        message.success(`Tài khoản ${user.fullName} đã được kích hoạt hoạt động.`);
      }
      await fetchUsers();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Lỗi khi cập nhật trạng thái hoạt động.');
    }
  };

  const handleResetPassword = (user: UserListItem) => {
    Modal.confirm({
      title: 'Xác nhận đặt lại mật khẩu',
      icon: <CheckCircleOutlined className="text-[var(--app-accent)]" />,
      content: `Mật khẩu đăng nhập của tài khoản ${user.fullName} sẽ được thiết lập về giá trị mặc định (${DEFAULT_PASSWORD}). Bạn có chắc chắn muốn tiếp tục?`,
      okText: 'Xác nhận đặt lại',
      cancelText: 'Hủy bỏ',
      okButtonProps: { className: 'bg-[var(--app-accent)] font-semibold' },
      async onOk() {
        try {
          await usersApi.update(user._id, { password: DEFAULT_PASSWORD });
          message.success(`Đã khôi phục mật khẩu mặc định cho tài khoản ${user.fullName} thành công.`);
        } catch (error) {
          message.error(getErrorMessage(error) || 'Lỗi đặt lại mật khẩu.');
        }
      }
    });
  };

  const handleAssignAdvisorClick = (user: UserListItem) => {
    setAdvisorUser(user);
    setAdvisorModalOpen(true);
  };

  const handleSaveAdvisorDuty = async (values: {
    khoaId: string;
    boMonId: string;
    lopCoVanIds: string[];
  }) => {
    if (!advisorUser) return;
    setAdvisorSubmitting(true);
    try {
      await usersApi.assignAdvisorDuty(advisorUser._id, values);
      message.success(`Đã gán nhiệm vụ cố vấn cho ${advisorUser.fullName}.`);
      setAdvisorModalOpen(false);
      setAdvisorUser(null);
      fetchUsers();
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể gán quyền cố vấn.');
    } finally {
      setAdvisorSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Quản lý Người Dùng" 
          subtitle="Danh sách tài khoản và phân quyền cán bộ, giảng viên, sinh viên" 
        />
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={handleAddUserClick}
          className="h-10 rounded-lg font-semibold bg-[var(--app-accent)] border-none hover:bg-[var(--app-accent-hover)] transition-colors"
        >
          Thêm người dùng mới
        </Button>
      </div>

      <div className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] flex flex-col md:flex-row items-center justify-between gap-4 transition-colors">
        <div className="w-full md:w-80">
          <Input
            prefix={<SearchOutlined className="text-[var(--app-text-muted)] mr-2" />}
            placeholder="Tìm theo họ tên, email, khoa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            className="h-10 rounded-lg border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]"
          />
        </div>

        <Space size="middle" className="w-full md:w-auto justify-end flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-[var(--app-text-muted)] font-semibold hidden sm:inline">Vai trò:</span>
            <Select
              value={selectedRole}
              onChange={(val) => setSelectedRole(val)}
              className="w-56 h-10"
              options={[
                { value: 'all', label: 'Tất cả vai trò' },
                ...USER_ROLE_OPTIONS,
              ]}
            />
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-[var(--app-text-muted)] font-semibold hidden sm:inline">Trạng thái:</span>
            <Select
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              className="w-36 h-10"
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Hoạt động' },
                { value: 'inactive', label: 'Đang khóa' }
              ]}
            />
          </div>
        </Space>
      </div>

      <UserTable
        users={users}
        loading={loading}
        onEdit={handleEditUserClick}
        onViewDetails={handleViewDetailsClick}
        onToggleStatus={handleToggleStatus}
        onResetPassword={handleResetPassword}
        onAssignAdvisor={handleAssignAdvisorClick}
      />

      <UserFormModal
        open={formModalOpen}
        onCancel={() => setFormModalOpen(false)}
        onSave={handleSaveUser}
        editingUser={editingUser}
        submitting={submitting}
      />

      <AssignAdvisorModal
        open={advisorModalOpen}
        user={advisorUser}
        submitting={advisorSubmitting}
        onCancel={() => {
          setAdvisorModalOpen(false);
          setAdvisorUser(null);
        }}
        onSave={handleSaveAdvisorDuty}
      />

      <Modal
        open={detailsModalOpen}
        title={
          <span className="text-base font-semibold text-[var(--app-text)]">
            Hồ sơ người dùng chi tiết
          </span>
        }
        footer={[
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setDetailsModalOpen(false);
              setViewingAdvisorLops([]);
              setViewingOrgScope({ khoaName: '', boMonName: '' });
            }}
            className="bg-[var(--app-accent)] font-semibold"
          >
            Đóng cửa sổ
          </Button>
        ]}
        onCancel={() => {
          setDetailsModalOpen(false);
          setViewingAdvisorLops([]);
          setViewingOrgScope({ khoaName: '', boMonName: '' });
        }}
        width={600}
        destroyOnClose
      >
        {viewingUser && (
          <div className="pt-4 space-y-6">
            <div className="flex items-center space-x-4 bg-[var(--app-bg)] p-4 rounded-xl border border-[var(--app-border)]">
              <Avatar 
                size={64} 
                className="bg-[var(--app-accent)] text-white font-semibold text-xl"
              >
                {viewingUser.fullName.charAt(0).toUpperCase()}
              </Avatar>
              <div className="space-y-1">
                <h4 className="text-base font-semibold text-[var(--app-text)]">{viewingUser.fullName}</h4>
                <div className="flex items-center space-x-2">
                  <Tag color={getRoleTagColor(viewingUser.role)} className="rounded-md px-2 py-0.5 border-none font-semibold text-[10px]">
                    {ROLE_LABELS[viewingUser.role]}
                  </Tag>
                  <Badge 
                    status={viewingUser.isActive ? 'success' : 'error'} 
                    text={
                      <span className={`text-xs font-semibold ${viewingUser.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {viewingUser.isActive ? 'Tài khoản hoạt động' : 'Tài khoản đã khóa'}
                      </span>
                    } 
                  />
                </div>
              </div>
            </div>

            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Mã định danh ID</span>}>
                <span className="font-mono text-xs text-[var(--app-text)]">{viewingUser._id}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Họ và tên</span>}>
                <span className="text-xs font-semibold text-[var(--app-text)]">{viewingUser.fullName}</span>
              </Descriptions.Item>
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Địa chỉ Email</span>}>
                <span className="font-mono text-xs text-[var(--app-text)]">{viewingUser.email}</span>
              </Descriptions.Item>
              {viewingUser.studentId && (
                <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Mã sinh viên</span>}>
                  <span className="text-xs font-semibold text-[var(--app-text)]">{viewingUser.studentId}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Vai trò hệ thống</span>}>
                <span className="text-xs font-semibold text-[var(--app-text)]">{ROLE_LABELS[viewingUser.role]}</span>
              </Descriptions.Item>
              {viewingUser.role !== 'student' && (
                <>
                  <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Khoa</span>}>
                    <span className="text-xs font-medium text-[var(--app-text)]">
                      {viewingOrgScope.khoaName || viewingUser.faculty || 'Chưa gắn khoa'}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Bộ môn</span>}>
                    <span className="text-xs font-medium text-[var(--app-text)]">
                      {viewingOrgScope.boMonName || viewingUser.department || 'Chưa gắn bộ môn'}
                    </span>
                  </Descriptions.Item>
                </>
              )}
              {viewingUser.role === 'student' && (
                <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Đơn vị / Khoa ban</span>}>
                  <span className="text-xs font-medium text-[var(--app-text)]">
                    {viewingUser.department || viewingUser.faculty || '—'}
                  </span>
                </Descriptions.Item>
              )}
              {viewingUser.role !== 'student' && (
                <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Lớp đang cố vấn</span>}>
                  {viewingAdvisorLops.length ? (
                    <Space wrap size={[4, 4]}>
                      {viewingAdvisorLops.map((lop) => (
                        <Tag key={lop._id} color="cyan" className="m-0 text-[11px]">
                          {lop.code}
                          {lop.name ? ` — ${lop.name}` : ''}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <span className="text-xs text-[var(--app-text-muted)]">Chưa gán lớp cố vấn</span>
                  )}
                </Descriptions.Item>
              )}
              {viewingUser.phone && (
                <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Số điện thoại</span>}>
                  <span className="text-xs font-semibold text-[var(--app-text)]">{viewingUser.phone}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Ngày khởi tạo</span>}>
                <span className="text-xs font-semibold text-[var(--app-text)] flex items-center">
                  <CalendarOutlined className="mr-1.5 text-[var(--app-text-muted)]" />
                  {new Date(viewingUser.createdAt).toLocaleString('vi-VN')}
                </span>
              </Descriptions.Item>
              {viewingUser.lastLoginAt && (
                <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Đăng nhập gần nhất</span>}>
                  <span className="text-xs font-semibold text-[var(--app-text)]">
                    {new Date(viewingUser.lastLoginAt).toLocaleString('vi-VN')}
                  </span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label={<span className="font-semibold text-[var(--app-text-muted)] text-xs">Chứng thư số</span>}>
                <span className="text-xs font-semibold text-[var(--app-text)] flex items-center">
                  <SafetyCertificateOutlined className="mr-1.5 text-emerald-600" />
                  {viewingUser.role === 'student' ? 'Đã liên kết SmartCA (Lớp cá nhân)' : 'Đã đăng ký USB Token HSM chính chủ'}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
}
