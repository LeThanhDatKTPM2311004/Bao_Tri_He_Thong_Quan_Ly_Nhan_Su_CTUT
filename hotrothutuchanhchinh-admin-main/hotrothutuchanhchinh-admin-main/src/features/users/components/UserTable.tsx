import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import { CellText } from '@/shared/components/ui/CellText';
import { Tag, Dropdown } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  UnlockOutlined,
  DownOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { ROLE_LABELS, ROLES, type Role } from '@/shared/constants/roles';
import type { UserListItem } from '../types/users.types';

interface UserTableProps {
  users: UserListItem[];
  loading: boolean;
  onEdit: (user: UserListItem) => void;
  onViewDetails: (user: UserListItem) => void;
  onToggleStatus: (user: UserListItem) => void;
  onResetPassword: (user: UserListItem) => void;
  onAssignAdvisor: (user: UserListItem) => void;
}

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

export function UserTable({
  users,
  loading,
  onEdit,
  onViewDetails,
  onToggleStatus,
  onResetPassword,
  onAssignAdvisor,
}: UserTableProps) {
  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 180,
      ellipsis: true,
      sorter: (a: UserListItem, b: UserListItem) => a.fullName.localeCompare(b.fullName),
      render: (text: string) => <CellText strong>{text}</CellText>,
    },
    {
      title: 'Địa chỉ Email',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      ellipsis: true,
      sorter: (a: UserListItem, b: UserListItem) => a.email.localeCompare(b.email),
      render: (text: string) => <CellText mono>{text}</CellText>,
    },
    {
      title: 'Vai trò',
      dataIndex: 'role',
      key: 'role',
      width: 160,
      ellipsis: true,
      filters: Object.entries(ROLE_LABELS).map(([key, label]) => ({ text: label, value: key })),
      onFilter: (value: any, record: UserListItem) => record.role === value,
      render: (role: Role) => (
        <Tag
          color={getRoleTagColor(role)}
          className="rounded-md px-2.5 py-0.5 border-none font-semibold text-[10px]"
          title={ROLE_LABELS[role]}
        >
          {ROLE_LABELS[role]}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 110,
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'} className="rounded-md">
          {isActive ? 'Hoạt động' : 'Đã khóa'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 140,
      fixed: 'right' as const,
      render: (_: any, record: UserListItem) => (
        <Dropdown.Button
          size="small"
          icon={<DownOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            onViewDetails(record);
          }}
          menu={{
            onClick: ({ domEvent }) => domEvent.stopPropagation(),
            items: [
              {
                key: 'edit',
                icon: <EditOutlined className="text-amber-500" />,
                label: 'Chỉnh sửa',
                onClick: () => onEdit(record),
              },
              ...(record.role !== ROLES.ADMIN && record.role !== ROLES.STUDENT
                ? [
                    {
                      key: 'advisor',
                      icon: <TeamOutlined className="text-teal-500" />,
                      label: 'Gán quyền cố vấn',
                      onClick: () => onAssignAdvisor(record),
                    },
                  ]
                : []),
              {
                key: 'reset',
                icon: <KeyOutlined className="text-cyan-500" />,
                label: 'Đặt lại mật khẩu',
                onClick: () => onResetPassword(record),
              },
              ...(record.role !== ROLES.ADMIN
                ? [
                    {
                      key: 'status',
                      icon: record.isActive ? (
                        <LockOutlined className="text-rose-500" />
                      ) : (
                        <UnlockOutlined className="text-emerald-500" />
                      ),
                      label: record.isActive ? 'Khóa tài khoản' : 'Kích hoạt tài khoản',
                      onClick: () => onToggleStatus(record),
                    },
                  ]
                : []),
            ],
          }}
        >
          <EyeOutlined /> <span className="hidden sm:inline">Chi tiết</span>
        </Dropdown.Button>
      ),
    },
  ];

  return (
    <ResponsiveTable
      columns={columns}
      dataSource={users}
      loading={loading}
      rowKey="_id"
      pagination={{
        pageSize: 7,
        showSizeChanger: false,
        className: 'pt-4 px-2 text-[var(--app-text-muted)]',
      }}
      className="border border-[var(--app-border)] rounded-xl overflow-hidden bg-[var(--app-surface)]"
    />
  );
}
