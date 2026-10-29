import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Progress,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { reportsApi } from '../services/reportsApi';
import type { AssistantReportsData } from '../types/reports.types';

const { RangePicker } = DatePicker;

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

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AssistantReportsPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<AssistantReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  const queryParams = useMemo(() => {
    if (!range?.[0] || !range?.[1]) return undefined;
    return {
      from: range[0].startOf('day').toISOString(),
      to: range[1].endOf('day').toISOString(),
    };
  }, [range]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.getAssistantUnitReport(queryParams);
      setData(res.data.data);
    } catch (err) {
      setError(getErrorMessage(err));
      // Giữ data cũ khi làm mới lỗi
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await reportsApi.exportAssistantUnitReport(queryParams);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `thong-ke-tro-ly-${dayjs().format('YYYYMMDD-HHmm')}.csv`);
      message.success('Đã xuất thống kê CSV');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;
  const monthly = data?.monthly ?? [];
  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(m.requests, m.completed)));

  const statusColumns = [
    {
      title: 'Trạng thái',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, row: { status: string }) => (
        <Tag color={kindColor[row.status] || 'default'}>{label}</Tag>
      ),
    },
    {
      title: 'Số lượng',
      dataIndex: 'count',
      key: 'count',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Tỷ lệ',
      key: 'rate',
      render: (_: unknown, row: { count: number }) => {
        const total = summary?.total || 0;
        const pct = total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0;
        return <Progress percent={pct} size="small" />;
      },
    },
  ];

  const procedureColumns = [
    {
      title: 'Loại đơn',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Tổng',
      dataIndex: 'value',
      key: 'value',
      width: 80,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Hoàn tất',
      dataIndex: 'completed',
      key: 'completed',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (
        <span className="text-emerald-600 font-semibold">{v.toLocaleString('vi-VN')}</span>
      ),
    },
    {
      title: 'Quá hạn',
      dataIndex: 'overdue',
      key: 'overdue',
      width: 90,
      align: 'right' as const,
      render: (v: number) => (
        <span className="text-rose-600 font-semibold">{v.toLocaleString('vi-VN')}</span>
      ),
    },
    {
      title: 'Chờ trưởng',
      dataIndex: 'waitingLeader',
      key: 'waitingLeader',
      width: 100,
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Tỷ lệ hoàn tất',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 150,
      render: (pct: number, row: { color?: string }) => (
        <Progress percent={pct} size="small" strokeColor={row.color || '#3b82f6'} />
      ),
    },
  ];

  const remindColumns = [
    {
      title: 'Mã',
      dataIndex: 'submissionCode',
      key: 'submissionCode',
      width: 90,
      render: (v: string) => <span className="font-mono font-semibold">{v}</span>,
    },
    {
      title: 'Hồ sơ',
      dataIndex: 'formName',
      key: 'formName',
      ellipsis: true,
    },
    {
      title: 'Người nộp',
      dataIndex: 'submittedBy',
      key: 'submittedBy',
      width: 140,
      ellipsis: true,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'kind',
      key: 'kind',
      width: 130,
      render: (kind: string) => (
        <Tag color={kindColor[kind] || 'default'}>{kindLabel[kind] || kind}</Tag>
      ),
    },
    {
      title: 'Hạn',
      dataIndex: 'deadlineAt',
      key: 'deadlineAt',
      width: 110,
      render: (v?: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
    },
  ];

  const statCards = [
    {
      title: 'Tổng trong phạm vi',
      value: summary?.total ?? 0,
      icon: <FileTextOutlined className="text-blue-600" />,
      colorClass: 'bg-blue-50 dark:bg-blue-950/40',
      label: 'đơn thuộc đơn vị theo dõi',
    },
    {
      title: 'Chờ trưởng ký',
      value: summary?.waitingLeader ?? 0,
      icon: <ClockCircleOutlined className="text-amber-600" />,
      colorClass: 'bg-amber-50 dark:bg-amber-950/40',
      label: 'cần nhắc duyệt',
    },
    {
      title: 'Quá hạn',
      value: summary?.overdue ?? 0,
      icon: <WarningOutlined className="text-rose-500" />,
      colorClass: 'bg-rose-50 dark:bg-rose-950/40',
      label: `tỷ lệ ${summary?.overdueRate ?? 0}%`,
    },
    {
      title: 'Sắp quá hạn',
      value: summary?.dueSoon ?? 0,
      icon: <ClockCircleOutlined className="text-orange-500" />,
      colorClass: 'bg-orange-50 dark:bg-orange-950/40',
      label: 'còn ≤ 2 ngày',
    },
    {
      title: 'Đã hoàn tất',
      value: summary?.completed ?? 0,
      icon: <CheckCircleOutlined className="text-emerald-500" />,
      colorClass: 'bg-emerald-50 dark:bg-emerald-950/40',
      label: `tỷ lệ ${summary?.completionRate ?? 0}%`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <PageHeader
          title="Thống kê đơn vị"
          subtitle={`${data?.scopeLabel ? `Phạm vi: ${data.scopeLabel}. ` : ''}Theo dõi hiệu suất xử lý đơn thuộc khoa/phòng/trung tâm của bạn.`}
        />
        <Space wrap className="shrink-0">
          <RangePicker
            value={range}
            onChange={(values) => setRange(values)}
            format="DD/MM/YYYY"
            allowClear
            placeholder={['Từ ngày', 'Đến ngày']}
          />
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={exporting}
            onClick={() => void handleExport()}
          >
            Xuất CSV
          </Button>
          <Button onClick={() => navigate('/workflows/assistant-monitor')}>Theo dõi đơn</Button>
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được thống kê"
          description={error}
          action={
            <Button size="small" onClick={() => void loadData()}>
              Thử lại
            </Button>
          }
        />
      )}

      <Spin spinning={loading}>
      <Row gutter={[16, 16]}>
        {statCards.map((card) => (
          <Col key={card.title} xs={24} sm={12} lg={8} xl={4} flex="1 1 180px">
            <Card className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] h-full">
              <div className="flex justify-between items-start gap-2">
                <div className="space-y-1 min-w-0">
                  <span className="text-[11px] font-semibold text-[var(--app-text-muted)] uppercase tracking-wide block">
                    {card.title}
                  </span>
                  <div className="text-2xl font-semibold text-[var(--app-text)] tracking-tight">
                    {loading && !summary ? '—' : card.value.toLocaleString('vi-VN')}
                  </div>
                  <span className="text-[11px] text-[var(--app-text-muted)]">{card.label}</span>
                </div>
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${card.colorClass}`}
                >
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <span className="text-sm font-semibold text-[var(--app-text)]">
                Xu hướng 6 tháng gần đây
              </span>
            }
            className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]"
          >
            {loading && !data ? (
              <div className="py-16 flex justify-center">
                <Spin />
              </div>
            ) : monthly.length === 0 ? (
              <Empty description="Chưa có dữ liệu theo tháng" />
            ) : (
              <div className="overflow-x-auto py-2">
                <svg viewBox="0 0 520 220" className="w-full min-w-[360px]">
                  {monthly.map((item, index) => {
                    const gap = 480 / monthly.length;
                    const x = 30 + gap * index + gap * 0.2;
                    const barW = gap * 0.28;
                    const hReq = (item.requests / maxMonthly) * 150;
                    const hDone = (item.completed / maxMonthly) * 150;
                    return (
                      <g key={item.month}>
                        <rect
                          x={x}
                          y={180 - hReq}
                          width={barW}
                          height={hReq}
                          rx={3}
                          fill="#3b82f6"
                          opacity={0.85}
                        />
                        <rect
                          x={x + barW + 4}
                          y={180 - hDone}
                          width={barW}
                          height={hDone}
                          rx={3}
                          fill="#10b981"
                          opacity={0.9}
                        />
                        <text
                          x={x + barW}
                          y={200}
                          textAnchor="middle"
                          className="fill-[var(--app-text-muted)]"
                          fontSize="11"
                        >
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="flex gap-4 text-xs text-[var(--app-text-muted)] font-semibold px-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Trong phạm vi
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Hoàn tất
                  </span>
                </div>
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <span className="text-sm font-semibold text-[var(--app-text)]">
                Phân bố trạng thái
              </span>
            }
            className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]"
          >
            <Table
              size="small"
              rowKey="status"
              loading={loading}
              pagination={false}
              columns={statusColumns}
              dataSource={data?.byStatus ?? []}
              locale={{ emptyText: <Empty description="Chưa có dữ liệu" /> }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <span className="text-sm font-semibold text-[var(--app-text)]">
            Thống kê theo loại đơn
          </span>
        }
        className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]"
      >
        <Table
          size="small"
          rowKey="name"
          loading={loading}
          columns={procedureColumns}
          dataSource={data?.byProcedure ?? []}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="Chưa có dữ liệu loại đơn" /> }}
        />
      </Card>

      <Card
        title={
          <span className="text-sm font-semibold text-[var(--app-text)]">
            Ưu tiên nhắc trưởng ký
          </span>
        }
        className="border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]"
        extra={
          <Button type="link" size="small" onClick={() => navigate('/workflows/assistant-monitor')}>
            Xem tất cả
          </Button>
        }
      >
        <Table
          size="small"
          rowKey="submissionId"
          loading={loading}
          columns={remindColumns}
          dataSource={data?.topRemind ?? []}
          pagination={false}
          locale={{ emptyText: <Empty description="Không có đơn cần nhắc lúc này" /> }}
        />
      </Card>
      </Spin>
    </div>
  );
}
