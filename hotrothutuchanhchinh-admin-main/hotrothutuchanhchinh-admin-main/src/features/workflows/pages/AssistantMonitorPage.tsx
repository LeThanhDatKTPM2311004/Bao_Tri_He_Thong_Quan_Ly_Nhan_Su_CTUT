import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Select, Space, Tabs, Tag, message } from 'antd';
import {
  EyeOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { ResponsiveTable } from '@/shared/components/ui/ResponsiveTable';
import { CellText } from '@/shared/components/ui/CellText';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { workflowsApi } from '../services/workflowsApi';
import type { AssistantMonitorItem } from '../types/workflows.types';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';
import { useAppSelector } from '@/store/hooks';
import { ROLES, ROLE_LABELS, type Role } from '@/shared/constants/roles';

const kindColor: Record<string, string> = {
  overdue: 'error',
  due_soon: 'warning',
  waiting_leader: 'processing',
  in_progress: 'blue',
  completed: 'success',
  cancelled: 'default',
};

const kindLabel: Record<string, string> = {
  overdue: 'Quá hạn',
  due_soon: 'Sắp quá hạn',
  waiting_leader: 'Chờ trưởng ký',
  in_progress: 'Đang xử lý',
  completed: 'Đã hoàn tất',
  cancelled: 'Đã hủy',
};

type MonitorFilter = 'all' | 'waiting_leader' | 'overdue' | 'due_soon' | 'completed';

async function openOrPrintPdf(fileUrl: string, mode: 'view' | 'print') {
  const blob = await workflowsApi.viewSubmissionFile(fileUrl);
  const pdfBlob =
    blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(pdfBlob);

  if (mode === 'view') {
    window.open(objectUrl, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const printWindow = window.open(objectUrl, '_blank', 'noopener,noreferrer');
  if (!printWindow) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Trình duyệt chặn cửa sổ in. Hãy cho phép popup rồi thử lại.');
  }

  let printed = false;
  const triggerPrint = () => {
    if (printed || printWindow.closed) return;
    printed = true;
    try {
      printWindow.focus();
      printWindow.print();
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
  };

  printWindow.addEventListener('load', () => {
    setTimeout(triggerPrint, 400);
  });
  setTimeout(triggerPrint, 1200);
}

function matchesTab(item: AssistantMonitorItem, filter: MonitorFilter) {
  if (filter === 'all') return true;
  if (filter === 'waiting_leader') {
    return Boolean(
      item.waitingLeader ||
        item.kind === 'waiting_leader' ||
        item.kind === 'due_soon' ||
        item.kind === 'overdue',
    );
  }
  if (filter === 'overdue') return Boolean(item.isOverdue || item.kind === 'overdue');
  if (filter === 'due_soon') return Boolean(item.isDueSoon || item.kind === 'due_soon');
  if (filter === 'completed') return item.kind === 'completed';
  return true;
}

export function AssistantMonitorPage() {
  const { user } = useAppSelector((state) => state.auth);
  const [items, setItems] = useState<AssistantMonitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<MonitorFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formNameFilter, setFormNameFilter] = useState<string | undefined>();
  const [stepFilter, setStepFilter] = useState<string | undefined>();
  const [busyId, setBusyId] = useState<string | null>(null);

  const scopeLabel = useMemo(() => {
    if (!user?.role) return '';
    if (user.role === ROLES.KHOA_ASSISTANT) {
      return user.faculty ? `Phạm vi: ${user.faculty}` : 'Phạm vi: theo khoa được gán';
    }
    if (
      user.role === ROLES.PHONG_ASSISTANT ||
      user.role === ROLES.TRUNG_TAM_ASSISTANT
    ) {
      return user.department
        ? `Phạm vi: ${user.department}`
        : 'Phạm vi: theo phòng/trung tâm được gán';
    }
    return ROLE_LABELS[user.role as Role] || '';
  }, [user]);

  const fetchItems = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const response = await workflowsApi.getAssistantMonitor('all');
      setItems(response.data.data || []);
    } catch (error) {
      if (!opts?.silent) {
        message.error(getErrorMessage(error) || 'Không thể tải danh sách theo dõi đơn vị');
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  useLiveRefresh(() => fetchItems({ silent: true }));

  const formNameOptions = useMemo(() => {
    const names = [...new Set(items.map((i) => i.formName).filter(Boolean))];
    return names
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((name) => ({ value: name, label: name }));
  }, [items]);

  const stepOptions = useMemo(() => {
    const steps = [...new Set(items.map((i) => i.currentStep).filter(Boolean) as string[])];
    return steps
      .sort((a, b) => a.localeCompare(b, 'vi'))
      .map((step) => ({ value: step, label: step }));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (!matchesTab(item, filter)) return false;
      if (formNameFilter && item.formName !== formNameFilter) return false;
      if (stepFilter && item.currentStep !== stepFilter) return false;
      if (!q) return true;
      return `${item.submissionCode} ${item.formName} ${item.submittedBy} ${item.currentStep || ''} ${
        kindLabel[item.kind] || item.kind
      }`
        .toLowerCase()
        .includes(q);
    });
  }, [filter, formNameFilter, items, searchQuery, stepFilter]);

  const counts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const narrowed = items.filter((item) => {
      if (formNameFilter && item.formName !== formNameFilter) return false;
      if (stepFilter && item.currentStep !== stepFilter) return false;
      if (!q) return true;
      return `${item.submissionCode} ${item.formName} ${item.submittedBy} ${item.currentStep || ''} ${
        kindLabel[item.kind] || item.kind
      }`
        .toLowerCase()
        .includes(q);
    });

    return {
      all: narrowed.length,
      waiting_leader: narrowed.filter((i) => matchesTab(i, 'waiting_leader')).length,
      overdue: narrowed.filter((i) => matchesTab(i, 'overdue')).length,
      due_soon: narrowed.filter((i) => matchesTab(i, 'due_soon')).length,
      completed: narrowed.filter((i) => matchesTab(i, 'completed')).length,
    };
  }, [formNameFilter, items, searchQuery, stepFilter]);

  const hasExtraFilters = Boolean(searchQuery.trim() || formNameFilter || stepFilter);

  const clearExtraFilters = () => {
    setSearchQuery('');
    setFormNameFilter(undefined);
    setStepFilter(undefined);
  };

  const handleView = async (row: AssistantMonitorItem) => {
    if (!row.fileUrl) {
      message.warning('Hồ sơ chưa có file để xem');
      return;
    }
    setBusyId(row.submissionId);
    try {
      await openOrPrintPdf(row.fileUrl, 'view');
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể mở file hồ sơ');
    } finally {
      setBusyId(null);
    }
  };

  const handlePrint = async (row: AssistantMonitorItem) => {
    if (!row.fileUrl) {
      message.warning('Hồ sơ chưa có file để in');
      return;
    }
    setBusyId(row.submissionId);
    try {
      await openOrPrintPdf(row.fileUrl, 'print');
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể in tờ đơn');
    } finally {
      setBusyId(null);
    }
  };

  const columns = [
    {
      title: 'Mã hồ sơ',
      dataIndex: 'submissionCode',
      key: 'submissionCode',
      width: 100,
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
      render: (text: string) => <CellText lines={2}>{text}</CellText>,
    },
    {
      title: 'Người nộp',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 150,
      render: (text: string) => <CellText>{text}</CellText>,
    },
    {
      title: 'Bước / trạng thái',
      dataIndex: 'currentStep',
      key: 'currentStep',
      width: 160,
      render: (text: string, row: AssistantMonitorItem) => (
        <Space direction="vertical" size={2}>
          <CellText>{text || '—'}</CellText>
          <Tag color={kindColor[row.kind] || 'default'}>{kindLabel[row.kind] || row.kind}</Tag>
        </Space>
      ),
    },
    {
      title: 'Hạn xử lý',
      dataIndex: 'deadlineAt',
      key: 'deadlineAt',
      width: 130,
      render: (value?: string | null) =>
        value ? new Date(value).toLocaleDateString('vi-VN') : '—',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: unknown, row: AssistantMonitorItem) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            loading={busyId === row.submissionId}
            disabled={!row.fileUrl}
            onClick={() => void handleView(row)}
          >
            Xem
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<PrinterOutlined />}
            loading={busyId === row.submissionId}
            disabled={!row.canPrint || !row.fileUrl}
            onClick={() => void handlePrint(row)}
          >
            In
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Theo dõi đơn đơn vị"
        subtitle={`${scopeLabel}. Chỉ đơn thuộc đúng khoa/phòng/trung tâm của bạn. Không có quyền ký duyệt — dùng để nhắc trưởng xử lý.`}
      />

      <Card className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-wrap">
          <Input
            allowClear
            prefix={<SearchOutlined className="text-[var(--app-text-muted)]" />}
            placeholder="Tìm mã hồ sơ, tên đơn, người nộp, bước…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full lg:max-w-sm"
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Loại đơn"
            value={formNameFilter}
            onChange={(value) => setFormNameFilter(value)}
            options={formNameOptions}
            className="w-full sm:w-56"
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Bước hiện tại"
            value={stepFilter}
            onChange={(value) => setStepFilter(value)}
            options={stepOptions}
            className="w-full sm:w-52"
          />
          <Space wrap>
            {hasExtraFilters ? (
              <Button onClick={clearExtraFilters}>Xóa lọc</Button>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={() => void fetchItems()} loading={loading}>
              Tải lại
            </Button>
          </Space>
        </div>
      </Card>

      <Tabs
        activeKey={filter}
        onChange={(key) => setFilter(key as MonitorFilter)}
        items={[
          { key: 'all', label: `Tất cả (${counts.all})` },
          { key: 'waiting_leader', label: `Chờ trưởng (${counts.waiting_leader})` },
          { key: 'overdue', label: `Quá hạn (${counts.overdue})` },
          { key: 'due_soon', label: `Sắp quá hạn (${counts.due_soon})` },
          { key: 'completed', label: `Đã hoàn tất (${counts.completed})` },
        ]}
      />

      <ResponsiveTable
        rowKey="submissionId"
        loading={loading}
        columns={columns}
        dataSource={filteredItems}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `${total} hồ sơ`,
        }}
      />
    </div>
  );
}
