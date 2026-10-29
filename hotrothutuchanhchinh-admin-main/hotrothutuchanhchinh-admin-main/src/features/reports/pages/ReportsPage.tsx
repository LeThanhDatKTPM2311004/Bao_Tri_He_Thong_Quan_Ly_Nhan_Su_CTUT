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
  CloseCircleOutlined,
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { reportsApi } from '../services/reportsApi';
import type { ReportsData } from '../types/reports.types';

const { RangePicker } = DatePicker;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
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
      const res = await reportsApi.getWorkflowPerformance(queryParams);
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
      const res = await reportsApi.exportReport(queryParams);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const stamp = dayjs().format('YYYYMMDD-HHmm');
      downloadBlob(blob, `bao-cao-thong-ke-${stamp}.csv`);
      message.success('Đã xuất báo cáo CSV');
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const summary = data?.summary;
  const monthly = data?.monthly ?? [];
  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(m.requests, m.approved)));

  const statusColumns = [
    {
      title: 'Trạng thái',
      dataIndex: 'label',
      key: 'label',
      render: (label: string, row: { status: string }) => {
        const colorMap: Record<string, string> = {
          pending: 'gold',
          in_progress: 'blue',
          completed: 'green',
          rejected: 'red',
          overdue: 'volcano',
        };
        return <Tag color={colorMap[row.status] || 'default'}>{label}</Tag>;
      },
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
        return <Progress percent={pct} size="small" status="active" />;
      },
    },
  ];

  const procedureColumns = [
    {
      title: 'Thủ tục / loại đơn',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: 'Tổng',
      dataIndex: 'value',
      key: 'value',
      align: 'right' as const,
      width: 90,
      render: (v: number) => v.toLocaleString('vi-VN'),
    },
    {
      title: 'Hoàn thành',
      dataIndex: 'completed',
      key: 'completed',
      align: 'right' as const,
      width: 110,
      render: (v: number) => (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          {v.toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: 'Từ chối',
      dataIndex: 'rejected',
      key: 'rejected',
      align: 'right' as const,
      width: 90,
      render: (v: number) => (
        <span className="text-rose-600 dark:text-rose-400 font-semibold">
          {v.toLocaleString('vi-VN')}
        </span>
      ),
    },
    {
      title: 'Tỷ lệ',
      dataIndex: 'percentage',
      key: 'percentage',
      width: 160,
      render: (pct: number, row: { color?: string }) => (
        <Progress
          percent={pct}
          size="small"
          strokeColor={row.color || '#3b82f6'}
          format={(p) => `${p}%`}
        />
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <PageHeader
          title="Báo cáo & Thống kê"
          subtitle="Phân tích hồ sơ, tỷ lệ xử lý và hiệu suất theo thời gian"
        />
        <Space wrap className="shrink-0">
          <RangePicker
            value={range}
            onChange={(values) => setRange(values)}
            format="DD/MM/YYYY"
            allowClear
            className="w-full sm:w-auto"
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
        </Space>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được báo cáo"
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
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-tight text-[var(--app-text-muted)]">
                    Tổng hồ sơ
                  </div>
                  <div className="text-3xl font-semibold text-[var(--app-text)] tracking-tight mt-1">
                    {(summary?.total ?? 0).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center">
                  <FileTextOutlined className="text-blue-600" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-tight text-[var(--app-text-muted)]">
                    Đang chờ / xử lý
                  </div>
                  <div className="text-3xl font-semibold text-amber-600 tracking-tight mt-1">
                    {(summary?.waiting ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)] mt-1">
                    Chờ {summary?.pending ?? 0} · Xử lý {summary?.inProgress ?? 0} · Quá hạn{' '}
                    {summary?.overdue ?? 0}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
                  <ClockCircleOutlined className="text-amber-600" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-tight text-[var(--app-text-muted)]">
                    Hoàn thành
                  </div>
                  <div className="text-3xl font-semibold text-emerald-600 tracking-tight mt-1">
                    {(summary?.completed ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)] mt-1">
                    Tỷ lệ {summary?.completionRate ?? 0}%
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                  <CheckCircleOutlined className="text-emerald-500" />
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold tracking-tight text-[var(--app-text-muted)]">
                    Từ chối / TB xử lý
                  </div>
                  <div className="text-3xl font-semibold text-rose-600 tracking-tight mt-1">
                    {(summary?.rejected ?? 0).toLocaleString('vi-VN')}
                  </div>
                  <div className="text-[11px] text-[var(--app-text-muted)] mt-1 flex items-center gap-1">
                    <WarningOutlined />
                    {summary?.rejectionRate ?? 0}% từ chối
                    {summary?.avgProcessingDays != null
                      ? ` · TB ${summary.avgProcessingDays} ngày`
                      : ''}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
                  <CloseCircleOutlined className="text-rose-500" />
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} className="mt-1">
          <Col xs={24} lg={14}>
            <Card
              title={
                <span className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
                  Tiếp nhận & duyệt theo tháng
                </span>
              }
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] h-full"
            >
              {monthly.length === 0 ? (
                <Empty description="Chưa có dữ liệu theo tháng" />
              ) : (
                <div className="space-y-4 pt-1">
                  <div className="flex gap-4 text-xs font-semibold text-[var(--app-text-muted)]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Tổng nhận
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Đã duyệt
                    </span>
                  </div>
                  {monthly.map((row) => (
                    <div key={row.month} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-[var(--app-text)]">
                        <span>{row.month}</span>
                        <span>
                          {row.requests} / {row.approved}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[var(--app-bg)] overflow-hidden relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-blue-500/80 rounded-full"
                          style={{ width: `${(row.requests / maxMonthly) * 100}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 bg-emerald-400 rounded-full"
                          style={{ width: `${(row.approved / maxMonthly) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={10}>
            <Card
              title={
                <span className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
                  Phân bố theo trạng thái
                </span>
              }
              className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] h-full"
            >
              <Table
                size="small"
                rowKey="status"
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
            <span className="text-sm font-semibold tracking-tight text-[var(--app-text)]">
              Thống kê theo thủ tục
            </span>
          }
          className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] mt-4"
        >
          <Table
            size="middle"
            rowKey="name"
            pagination={false}
            columns={procedureColumns}
            dataSource={data?.byProcedure ?? []}
            scroll={{ x: 640 }}
            locale={{ emptyText: <Empty description="Chưa có dữ liệu thủ tục" /> }}
          />
        </Card>
      </Spin>
    </div>
  );
}
