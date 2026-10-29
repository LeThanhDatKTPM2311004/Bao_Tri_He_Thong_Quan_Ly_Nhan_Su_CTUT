import { Dropdown, Tag } from 'antd';
import type { TableProps } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import { CellText } from '@/shared/components/ui/CellText';
import type { PendingTask, StaffProcessMode } from '../types/workflows.types';

interface PendingTasksTableProps {
  tasks: PendingTask[];
  loading?: boolean;
  selectedRowKeys?: React.Key[];
  onSelectedRowKeysChange?: (keys: React.Key[], rows: PendingTask[]) => void;
  onView: (task: PendingTask) => void;
  onProcess: (id: string, mode: StaffProcessMode) => void;
  onReject: (id: string) => void;
  onReturn: (id: string) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const resolveDaysRemaining = (task: PendingTask): number | null => {
  if (typeof task.daysRemaining === 'number' && Number.isFinite(task.daysRemaining)) {
    return task.daysRemaining;
  }
  if (task.deadlineAt) {
    const deadline = new Date(task.deadlineAt).getTime();
    if (!Number.isNaN(deadline)) {
      return Math.ceil((deadline - Date.now()) / DAY_MS);
    }
  }
  return null;
};

const renderDaysRemaining = (task: PendingTask) => {
  const days = resolveDaysRemaining(task);
  if (days == null) {
    return <span className="text-[var(--app-text-muted)]">Không giới hạn</span>;
  }
  if (task.isOverdue || days < 0) {
    const late = Math.abs(days);
    return <Tag color="error">{late === 0 ? 'Đã trễ hạn' : `Trễ ${late} ngày`}</Tag>;
  }
  if (days === 0) {
    return <Tag color="warning">Hết hạn hôm nay</Tag>;
  }
  if (days === 1) {
    return <Tag color="warning">Còn 1 ngày</Tag>;
  }
  if (days <= 3) {
    return <Tag color="orange">Còn {days} ngày</Tag>;
  }
  return <Tag color="success">Còn {days} ngày</Tag>;
};

export function PendingTasksTable({
  tasks,
  loading,
  selectedRowKeys,
  onSelectedRowKeysChange,
  onView,
  onProcess,
  onReject,
  onReturn,
}: PendingTasksTableProps) {
  const rowSelection: TableProps<PendingTask>['rowSelection'] | undefined = onSelectedRowKeysChange
    ? {
        selectedRowKeys,
        onChange: (keys, rows) => onSelectedRowKeysChange(keys, rows),
        preserveSelectedRowKeys: true,
      }
    : undefined;

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'submissionCode',
      key: 'submissionCode',
      width: 100,
      ellipsis: true,
      render: (text: string) => (
        <CellText mono strong>
          {text}
        </CellText>
      ),
    },
    {
      title: 'Hồ sơ',
      dataIndex: 'formName',
      key: 'formName',
      width: 220,
      ellipsis: true,
      render: (text: string) => <CellText lines={2}>{text}</CellText>,
    },
    {
      title: 'Người nộp',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 160,
      ellipsis: true,
      render: (text: string) => <CellText>{text}</CellText>,
    },
    {
      title: 'Bước hiện tại',
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 180,
      ellipsis: true,
      render: (step: string) => (
        <Tag color="processing" title={step}>
          {step}
        </Tag>
      ),
    },
    {
      title: 'Còn mấy ngày',
      key: 'daysRemaining',
      width: 140,
      render: (_: unknown, record: PendingTask) => renderDaysRemaining(record),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 130,
      fixed: 'right' as const,
      render: (_: unknown, record: PendingTask) => (
        <Dropdown.Button
          size="small"
          disabled={!record.fileUrl}
          icon={<DownOutlined />}
          onClick={() => {
            if (record.fileUrl) onView(record);
          }}
          menu={{
            items: [
              ...(record.requiresSignature
                ? []
                : [
                    {
                      key: 'approve',
                      icon: <CheckOutlined />,
                      label: record.currentStepAction === 'review' ? 'Đã kiểm tra' : 'Duyệt',
                      onClick: () => onProcess(record.submissionId, 'approve'),
                    },
                  ]),
              ...(record.allowSign === false
                ? []
                : [
                    {
                      key: 'sign',
                      icon: <SafetyCertificateOutlined />,
                      label: 'Ký số',
                      onClick: () => onProcess(record.submissionId, 'sign'),
                    },
                    {
                      key: 'handwritten',
                      icon: <EditOutlined />,
                      label: 'Ký tay',
                      onClick: () => onProcess(record.submissionId, 'handwritten'),
                    },
                  ]),
              ...(record.allowReturn === false
                ? []
                : [
                    { type: 'divider' as const },
                    {
                      key: 'return',
                      icon: <RollbackOutlined />,
                      label: record.returnTo === 'previous' ? 'Trả về bước trước' : 'Trả về sinh viên',
                      onClick: () => onReturn(record.submissionId),
                    },
                  ]),
              ...(record.allowReject === false
                ? []
                : [
                    { type: 'divider' as const },
                    {
                      key: 'reject',
                      icon: <CloseOutlined />,
                      label: <span className="text-red-500">Từ chối</span>,
                      danger: true,
                      onClick: () => onReject(record.submissionId),
                    },
                  ]),
            ],
          }}
        >
          <EyeOutlined /> <span className="hidden sm:inline">Xem</span>
        </Dropdown.Button>
      ),
    },
  ];

  return (
    <ResponsiveTable
      columns={columns}
      dataSource={tasks}
      loading={loading}
      rowKey="submissionId"
      rowSelection={rowSelection}
    />
  );
}
