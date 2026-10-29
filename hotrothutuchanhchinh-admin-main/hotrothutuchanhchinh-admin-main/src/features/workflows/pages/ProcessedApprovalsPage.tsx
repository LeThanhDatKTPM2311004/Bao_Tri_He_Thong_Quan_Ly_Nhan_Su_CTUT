import { useCallback, useEffect, useState } from 'react';
import { Button, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import { CellText } from '@/shared/components/ui/CellText';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { workflowsApi } from '../services/workflowsApi';
import type { ProcessedTask } from '../types/workflows.types';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const statusColor: Record<string, string> = {
  in_progress: 'processing',
  completed: 'success',
  rejected: 'error',
  cancelled: 'default',
  overdue: 'warning',
  pending: 'default',
};

const statusLabel: Record<string, string> = {
  in_progress: 'Đang xử lý',
  completed: 'Hoàn tất',
  rejected: 'Từ chối',
  cancelled: 'SV đã hủy',
  overdue: 'Trễ hạn',
  pending: 'Chờ gửi lại',
};

export function ProcessedApprovalsPage() {
  const [tasks, setTasks] = useState<ProcessedTask[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchProcessed = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const response = await workflowsApi.getProcessed();
      setTasks(response.data.data);
    } catch (error) {
      if (!opts?.silent) {
        message.error(getErrorMessage(error) || 'Không thể tải danh sách hồ sơ đã xử lý');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcessed();
  }, [fetchProcessed]);

  useLiveRefresh(() => fetchProcessed({ silent: true }));

  const handleView = async (task: ProcessedTask) => {
    if (!task.fileUrl) {
      message.warning('Hồ sơ này chưa có file đính kèm để xem');
      return;
    }
    try {
      const blob = await workflowsApi.viewSubmissionFile(task.fileUrl);
      const fileUrl = URL.createObjectURL(blob);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể mở file hồ sơ');
    }
  };

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
      width: 150,
      ellipsis: true,
      render: (text: string) => <CellText>{text}</CellText>,
    },
    {
      title: 'Hành động của bạn',
      dataIndex: 'myAction',
      key: 'myAction',
      width: 140,
      ellipsis: true,
      render: (action: string) => (
        <Tag color="blue" title={action}>
          {action}
        </Tag>
      ),
    },
    {
      title: 'Thời gian xử lý',
      dataIndex: 'myActionAt',
      key: 'myActionAt',
      width: 160,
      ellipsis: true,
      render: (date: string) => {
        const label = date ? new Date(date).toLocaleString('vi-VN') : '—';
        return <CellText title={label === '—' ? undefined : label}>{label}</CellText>;
      },
    },
    {
      title: 'Trạng thái hồ sơ',
      dataIndex: 'instanceStatus',
      key: 'instanceStatus',
      width: 120,
      render: (status: string) => (
        <Tag color={statusColor[status] || 'default'}>{statusLabel[status] || status}</Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 110,
      fixed: 'right' as const,
      render: (_: unknown, record: ProcessedTask) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleView(record)}
          disabled={!record.fileUrl}
        >
          <span className="hidden sm:inline">Xem</span>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6 min-w-0">
      <PageHeader title="Hồ sơ đã xử lý" subtitle="Các đơn bạn đã duyệt, ký hoặc trả về" />
      <ResponsiveTable columns={columns} dataSource={tasks} loading={loading} rowKey="_id" />
    </div>
  );
}
