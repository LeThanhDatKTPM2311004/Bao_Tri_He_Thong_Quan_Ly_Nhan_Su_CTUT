import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Card, Button, Empty, List, Steps, Spin, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  DownloadOutlined,
  FileProtectOutlined,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
  AreaChartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { DashboardStatsGrid } from '../components/StatCard';
import { dashboardApi } from '../services/dashboardApi';
import type { DashboardStats } from '../types/dashboard.types';
import { useAppSelector } from '@/store/hooks';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { isAssistant } from '@/shared/constants/roleGroups';
import { ROLE_LABELS, ROLES, type Role } from '@/shared/constants/roles';
import { useLiveRefresh } from '@/shared/hooks/useLiveRefresh';

const FALLBACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

function formatRelativeTime(value?: string) {
  if (!value) return '';
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'vừa xong';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
  if (diffSec < 172800) return 'Hôm qua';
  return new Date(value).toLocaleDateString('vi-VN');
}

export function DashboardPage() {
  const { user } = useAppSelector((state) => state.auth);
  const navigate = useNavigate();
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const assistantMode = isAssistant(user?.role) || stats?.mode === 'assistant';
  const roleLabel = user?.role ? ROLE_LABELS[user.role as Role] || user.role : '';

  const loadStats = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await dashboardApi.getStats();
      setStats(res.data.data);
    } catch (err) {
      if (!opts?.silent) setError(getErrorMessage(err));
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useLiveRefresh(() => loadStats({ silent: true }));

  const monthlyData = stats?.monthly?.length
    ? stats.monthly
    : Array.from({ length: 6 }, (_, i) => ({
        month: `T${((new Date().getMonth() - 5 + i + 12) % 12) + 1}`,
        requests: 0,
        approved: 0,
      }));

  const requestTypes = useMemo(() => {
    const rows = stats?.byProcedure ?? [];
    return rows.map((row, index) => ({
      ...row,
      color: row.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    }));
  }, [stats?.byProcedure]);

  const chartHeight = 220;
  const chartWidth = 500;
  const padding = 35;
  const graphHeight = chartHeight - 2 * padding;
  const graphWidth = chartWidth - 2 * padding;
  const maxVal = Math.max(1, ...monthlyData.map((m) => Math.max(m.requests, m.approved)));

  const radius = 65;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;
  const cx = 95;
  const cy = 95;
  let cumulativePercentage = 0;

  const procedureTotal = requestTypes.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="space-y-6" data-dashboard="live-stats-v2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--app-accent)] p-4 sm:p-5 rounded-xl text-white">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white m-0">
            Xin chào, {user?.fullName || 'Quản trị viên'}
          </h1>
          <p className="text-xs text-blue-100 font-medium m-0">
            {assistantMode
              ? `Tổng quan hỗ trợ nhắc duyệt · ${roleLabel} · `
              : 'Tổng quan thủ tục hành chính điện tử · '}
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          {assistantMode ? (
            <Button
              type="default"
              icon={<FileProtectOutlined />}
              className="w-full sm:w-auto font-semibold text-xs h-9 border-0 bg-white text-[var(--app-accent)] hover:!text-[var(--app-accent-hover)]"
              onClick={() => navigate('/workflows/assistant-monitor')}
            >
              Theo dõi đơn đơn vị
            </Button>
          ) : (
            <>
              <Button
                type="default"
                icon={<DownloadOutlined />}
                className="w-full sm:w-auto font-semibold text-xs h-9 border-0 bg-white text-[var(--app-accent)] hover:!text-[var(--app-accent-hover)]"
                onClick={() => navigate('/reports')}
              >
                Xuất báo cáo tháng
              </Button>
              <Button
                ghost
                icon={<AreaChartOutlined />}
                className="w-full sm:w-auto border-white/40 text-white hover:!border-white hover:!text-white font-semibold text-xs h-9"
                onClick={() => navigate('/reports')}
              >
                Báo cáo & Thống kê
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message="Không tải được thống kê tổng quan"
          description={error}
          action={
            <Button size="small" onClick={() => void loadStats()}>
              Thử lại
            </Button>
          }
        />
      )}

      <DashboardStatsGrid stats={stats} loading={loading} />

      {!assistantMode && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card
          title={
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 py-1">
              <span className="text-sm font-semibold text-[var(--app-text)] tracking-tight">
                Thống kê yêu cầu hàng tháng
              </span>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-[var(--app-text-muted)]">
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5"></span>Tổng nhận
                </span>
                <span className="flex items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 mr-1.5"></span>Đã duyệt
                </span>
              </div>
            </div>
          }
          className="lg:col-span-8 border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] transition-colors duration-300"
        >
          {loading && !stats ? (
            <div className="py-16 flex justify-center">
              <Spin />
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto py-2">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full min-w-[360px] sm:min-w-[450px] overflow-visible">
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                    const y = padding + graphHeight * (1 - ratio);
                    const labelVal = Math.round(maxVal * ratio);
                    return (
                      <g key={index}>
                        <line
                          x1={padding}
                          y1={y}
                          x2={chartWidth - padding}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                          className="dark:stroke-slate-800"
                        />
                        <text
                          x={padding - 8}
                          y={y + 4}
                          fill="#94a3b8"
                          fontSize="10"
                          textAnchor="end"
                          className="font-semibold"
                        >
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  <line
                    x1={padding}
                    y1={chartHeight - padding}
                    x2={chartWidth - padding}
                    y2={chartHeight - padding}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    className="dark:stroke-slate-800"
                  />

                  {monthlyData.map((item, index) => {
                    const barWidth = 32;
                    const gap = graphWidth / monthlyData.length;
                    const x = padding + gap * index + (gap - barWidth) / 2;
                    const requestsHeight = (item.requests / maxVal) * graphHeight;
                    const approvedHeight = (item.approved / maxVal) * graphHeight;
                    const yReq = chartHeight - padding - requestsHeight;
                    const yApp = chartHeight - padding - approvedHeight;
                    const isHovered = hoveredBar === index;

                    return (
                      <g key={`${item.month}-${index}`}>
                        <rect
                          x={padding + gap * index}
                          y={padding - 5}
                          width={gap}
                          height={graphHeight + 10}
                          fill={isHovered ? '#3b82f6' : 'transparent'}
                          fillOpacity="0.04"
                          onMouseEnter={() => setHoveredBar(index)}
                          onMouseLeave={() => setHoveredBar(null)}
                          className="cursor-pointer transition-all duration-200"
                        />
                        <rect
                          x={x}
                          y={yReq}
                          width={barWidth}
                          height={Math.max(requestsHeight, 0)}
                          rx="4"
                          fill={isHovered ? '#2563eb' : '#3b82f6'}
                          fillOpacity={isHovered ? '0.95' : '0.8'}
                          className="transition-all duration-300"
                        />
                        <rect
                          x={x + 6}
                          y={yApp}
                          width={barWidth - 12}
                          height={Math.max(approvedHeight, 0)}
                          rx="3"
                          fill="#34d399"
                          fillOpacity="0.9"
                          className="transition-all duration-300"
                        />
                        {isHovered && (
                          <g>
                            <rect x={x - 20} y={Math.max(yReq - 32, 4)} width={72} height={26} rx="6" fill="#0f172a" />
                            <text
                              x={x + 16}
                              y={Math.max(yReq - 15, 21)}
                              fill="#ffffff"
                              fontSize="9"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {item.requests} hồ sơ
                            </text>
                          </g>
                        )}
                        <text
                          x={padding + gap * index + gap / 2}
                          y={chartHeight - padding + 18}
                          fill="#64748b"
                          fontSize="10"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {item.month}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div className="mt-4 flex flex-col lg:flex-row lg:items-center justify-between gap-2 p-3 bg-[var(--app-bg)] rounded-xl text-xs font-semibold text-[var(--app-text-muted)]">
                <span className="flex items-center gap-1.5 text-[var(--app-accent)]">
                  <InfoCircleOutlined />
                  <span>
                    6 tháng gần nhất • Tổng nhận {monthlyData.reduce((s, m) => s + m.requests, 0).toLocaleString('vi-VN')} hồ sơ
                  </span>
                </span>
                <span className="text-[10px] text-[var(--app-text-muted)]">
                  Cập nhật: {loading ? 'đang tải…' : 'vừa xong'}
                </span>
              </div>
            </>
          )}
        </Card>

        <Card
          title={
            <span className="text-sm font-semibold text-[var(--app-text)] tracking-tight block py-1">
              Phân loại thủ tục hành chính
            </span>
          }
          className="lg:col-span-4 border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] transition-colors duration-300"
        >
          {loading && !stats ? (
            <div className="py-16 flex justify-center">
              <Spin />
            </div>
          ) : requestTypes.length === 0 ? (
            <Empty description="Chưa có hồ sơ để phân loại" className="py-10" />
          ) : (
            <div className="flex flex-col sm:flex-row lg:flex-col items-center justify-around py-2 gap-4">
              <div className="relative w-[190px] h-[190px]">
                <svg width="190" height="190" viewBox="0 0 190 190">
                  <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                    className="dark:stroke-slate-800"
                  />
                  {requestTypes.map((type, index) => {
                    const dashStroke = (type.percentage / 100) * circumference;
                    const strokeOffset = circumference - (cumulativePercentage / 100) * circumference;
                    cumulativePercentage += type.percentage;
                    const isHovered = hoveredSlice === index;
                    const currentStrokeWidth = isHovered ? strokeWidth + 4 : strokeWidth;

                    return (
                      <circle
                        key={`${type.name}-${index}`}
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke={type.color}
                        strokeWidth={currentStrokeWidth}
                        strokeDasharray={`${dashStroke} ${circumference}`}
                        strokeDashoffset={strokeOffset}
                        transform={`rotate(-90 ${cx} ${cy})`}
                        onMouseEnter={() => setHoveredSlice(index)}
                        onMouseLeave={() => setHoveredSlice(null)}
                        className="cursor-pointer transition-all duration-300"
                      />
                    );
                  })}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-[var(--app-text-muted)] font-semibold tracking-tight">
                    Tổng nhận
                  </span>
                  <span className="text-2xl font-semibold text-[var(--app-text)] tracking-tight">
                    {procedureTotal.toLocaleString('vi-VN')}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                {requestTypes.map((type, index) => {
                  const isHovered = hoveredSlice === index;
                  return (
                    <div
                      key={`${type.name}-legend`}
                      className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                        isHovered ? 'bg-[var(--app-accent-soft)]' : 'bg-transparent'
                      }`}
                      onMouseEnter={() => setHoveredSlice(index)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: type.color }}></span>
                        <span
                          className={`text-xs font-semibold truncate transition-colors ${
                            isHovered ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]'
                          }`}
                        >
                          {type.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 font-mono text-xs font-semibold text-[var(--app-text-muted)]">
                        <span>{type.value}</span>
                        <span className="text-[10px] text-[var(--app-text-muted)]">({type.percentage}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {!assistantMode ? (
        <Card
          title={
            <span className="text-sm font-semibold text-[var(--app-text)] tracking-tight block py-1">
              Quy trình kiểm soát & phê duyệt hồ sơ
            </span>
          }
          className="lg:col-span-7 border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] transition-colors duration-300"
        >
          <div className="py-2">
            <Steps
              direction="vertical"
              size="small"
              current={stats && stats.pendingApprovals > 0 ? 2 : 3}
              items={[
                {
                  title: (
                    <span className="font-semibold text-[var(--app-text)] text-sm">
                      Bước 1: Tiếp nhận đơn đề xuất
                    </span>
                  ),
                  description: (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      Tổng hồ sơ trong hệ thống:{' '}
                      <strong>{(stats?.totalSubmissions ?? 0).toLocaleString('vi-VN')}</strong>
                    </span>
                  ),
                  status: 'finish',
                  icon: <FileProtectOutlined className="text-emerald-500" />,
                },
                {
                  title: (
                    <span className="font-semibold text-[var(--app-text)] text-sm">
                      Bước 2: Phê duyệt / xử lý
                    </span>
                  ),
                  description: (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      Hồ sơ đã duyệt:{' '}
                      <strong>{(stats?.completedThisMonth ?? 0).toLocaleString('vi-VN')}</strong> • Từ chối:{' '}
                      <strong>{(stats?.rejectedCount ?? 0).toLocaleString('vi-VN')}</strong>
                    </span>
                  ),
                  status: 'finish',
                  icon: <CheckCircleOutlined className="text-emerald-500" />,
                },
                {
                  title: (
                    <span className="font-semibold text-[var(--app-text)] text-sm">
                      Bước 3: Hồ sơ đang chờ xử lý
                    </span>
                  ),
                  description: (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      Đang có{' '}
                      <strong className="text-amber-600">
                        {(stats?.pendingApprovals ?? 0).toLocaleString('vi-VN')} hồ sơ chờ xử lý
                      </strong>
                      .
                    </span>
                  ),
                  status: stats && stats.pendingApprovals > 0 ? 'process' : 'finish',
                  icon:
                    stats && stats.pendingApprovals > 0 ? (
                      <SyncOutlined spin className="text-[var(--app-accent)]" />
                    ) : (
                      <CheckCircleOutlined className="text-emerald-500" />
                    ),
                },
                {
                  title: (
                    <span className="font-semibold text-[var(--app-text-muted)] text-sm">
                      Bước 4: Ban hành / hoàn tất
                    </span>
                  ),
                  description: (
                    <span className="text-xs text-[var(--app-text-muted)]">
                      Theo dõi trạng thái hoàn tất trên từng quy trình cụ thể.
                    </span>
                  ),
                  status: 'wait',
                  icon: <ClockCircleOutlined className="text-[var(--app-text-muted)]" />,
                },
              ]}
            />
          </div>
        </Card>
        ) : (
        <Card
          title={
            <span className="text-sm font-semibold text-[var(--app-text)] tracking-tight block py-1">
              Việc cần làm — nhắc trưởng ký
            </span>
          }
          className="lg:col-span-7 border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] transition-colors duration-300"
        >
          <div className="space-y-3 py-2 text-sm text-[var(--app-text-muted)]">
            <p className="m-0">
              {user?.role === ROLES.PHONG_ASSISTANT
                ? 'Đơn tạm hoãn NVQS chờ bạn kiểm tra tại Hồ sơ chờ kiểm tra. Nếu sai, trả về sinh viên kèm lý do. Bạn không ký lên đơn.'
                : 'Bạn theo dõi đơn thuộc đơn vị và nhắc trưởng khoa / trưởng phòng / giám đốc trung tâm ký duyệt. Không có quyền ký hoặc từ chối trên hệ thống.'}
            </p>
            <ul className="m-0 pl-5 space-y-1">
              <li>
                Quá hạn:{' '}
                <strong className="text-rose-600">{(stats?.overdueCount ?? 0).toLocaleString('vi-VN')}</strong>
              </li>
              <li>
                Sắp quá hạn:{' '}
                <strong className="text-amber-600">{(stats?.dueSoonCount ?? 0).toLocaleString('vi-VN')}</strong>
              </li>
              <li>
                Đang chờ trưởng:{' '}
                <strong>{(stats?.waitingLeader ?? stats?.pendingApprovals ?? 0).toLocaleString('vi-VN')}</strong>
              </li>
            </ul>
            <div className="flex flex-wrap gap-2">
              {user?.role === ROLES.PHONG_ASSISTANT && (
                <Button type="primary" onClick={() => navigate('/workflows/pending')}>
                  Mở hồ sơ chờ kiểm tra
                </Button>
              )}
              <Button
                type={user?.role === ROLES.PHONG_ASSISTANT ? 'default' : 'primary'}
                onClick={() => navigate('/workflows/assistant-monitor')}
              >
                Mở theo dõi đơn đơn vị
              </Button>
            </div>
          </div>
        </Card>
        )}

        <Card
          title={
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 py-1">
              <span className="text-sm font-semibold text-[var(--app-text)] tracking-tight">
                {assistantMode ? 'Cần nhắc trưởng (ưu tiên)' : 'Hồ sơ ký số & phê duyệt gần đây'}
              </span>
              {!assistantMode ? (
              <Button
                type="link"
                size="small"
                icon={<AreaChartOutlined />}
                className="text-xs font-semibold"
                onClick={() => navigate('/reports')}
              >
                Xem báo cáo
              </Button>
              ) : (
              <Button
                type="link"
                size="small"
                className="text-xs font-semibold"
                onClick={() => navigate('/workflows/assistant-monitor')}
              >
                Xem tất cả
              </Button>
              )}
            </div>
          }
          className="lg:col-span-5 border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)] transition-colors duration-300"
        >
          <List
            locale={{
              emptyText: (
                <Empty
                  description={
                    assistantMode ? 'Không có đơn cần nhắc lúc này' : 'Chưa có hồ sơ gần đây'
                  }
                />
              ),
            }}
            itemLayout="horizontal"
            loading={loading}
            dataSource={stats?.recent ?? []}
            renderItem={(item) => (
              <List.Item className="px-0 py-3 border-[var(--app-border)]">
                <List.Item.Meta
                  avatar={
                    <Avatar
                      className={
                        item.status === 'approved'
                          ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : item.status === 'rejected'
                            ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/30 dark:text-rose-400'
                            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400'
                      }
                      icon={
                        item.status === 'approved' ? (
                          <SafetyCertificateOutlined />
                        ) : item.status === 'rejected' ? (
                          <CloseCircleOutlined />
                        ) : (
                          <SyncOutlined spin />
                        )
                      }
                    />
                  }
                  title={
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                      <span className="text-xs font-semibold text-[var(--app-text)]">
                        {item.studentName}{' '}
                        {item.studentId ? (
                          <span className="text-[10px] text-[var(--app-text-muted)] font-semibold">({item.studentId})</span>
                        ) : null}
                      </span>
                      <span className="text-[10px] text-[var(--app-text-muted)] font-mono">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                    </div>
                  }
                  description={
                    <div className="space-y-1">
                      <div className="text-xs font-medium text-[var(--app-text-muted)] break-words sm:truncate sm:max-w-[280px]">
                        {item.formName}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Tag
                          color={
                            item.status === 'approved'
                              ? 'success'
                              : item.status === 'rejected'
                                ? 'error'
                                : 'warning'
                          }
                          className="text-[9px] px-1.5 py-0 rounded border-none font-semibold tracking-tight"
                        >
                          {assistantMode
                            ? item.authType || 'Cần nhắc'
                            : item.status === 'approved'
                              ? 'Đã duyệt'
                              : item.status === 'rejected'
                                ? 'Từ chối'
                                : 'Chờ duyệt'}
                        </Tag>
                        {!assistantMode ? (
                        <span className="text-[10px] text-[var(--app-text-muted)] font-semibold italic">
                          {item.authType}
                        </span>
                        ) : null}
                      </div>
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        </Card>
      </div>
    </div>
  );
}
