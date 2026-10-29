import { Card, Skeleton } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { DashboardStats } from '../types/dashboard.types';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  label: string;
}

export function StatCard({ title, value, icon, colorClass, label }: StatCardProps) {
  return (
    <Card className="border border-[var(--app-border)] shadow-none hover:border-[var(--app-accent)]/30 transition-colors duration-200 rounded-xl bg-[var(--app-surface)]">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-[var(--app-text-muted)] uppercase tracking-wide block">
            {title}
          </span>
          <h3 className="text-2xl sm:text-3xl font-semibold text-[var(--app-text)] tracking-tight m-0">
            {value.toLocaleString('vi-VN')}
          </h3>
        </div>

        <div className={`w-11 h-11 rounded-lg flex items-center justify-center text-base ${colorClass}`}>
          {icon}
        </div>
      </div>

      <div className="mt-3">
        <span className="text-[11px] text-[var(--app-text-muted)] font-medium">{label}</span>
      </div>
    </Card>
  );
}

interface DashboardStatsGridProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

export function DashboardStatsGrid({ stats, loading }: DashboardStatsGridProps) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]">
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        ))}
      </div>
    );
  }

  const isAssistant = stats?.mode === 'assistant';

  const cards = isAssistant
    ? [
        {
          title: 'Chờ trưởng ký',
          value: stats?.waitingLeader ?? stats?.pendingApprovals ?? 0,
          icon: <ClockCircleOutlined className="text-amber-600 dark:text-amber-400" />,
          colorClass: 'bg-amber-50 dark:bg-amber-950/40',
          label: 'đơn thuộc đơn vị đang chờ trưởng',
        },
        {
          title: 'Quá hạn',
          value: stats?.overdueCount ?? 0,
          icon: <WarningOutlined className="text-rose-500 dark:text-rose-400" />,
          colorClass: 'bg-rose-50 dark:bg-rose-950/40',
          label: 'cần nhắc trưởng xử lý ngay',
        },
        {
          title: 'Sắp quá hạn',
          value: stats?.dueSoonCount ?? 0,
          icon: <ClockCircleOutlined className="text-orange-500 dark:text-orange-400" />,
          colorClass: 'bg-orange-50 dark:bg-orange-950/40',
          label: 'còn ≤ 2 ngày đến hạn',
        },
        {
          title: 'Hoàn tất tháng này',
          value: stats?.completedThisMonth ?? 0,
          icon: <CheckCircleOutlined className="text-emerald-500 dark:text-emerald-400" />,
          colorClass: 'bg-emerald-50 dark:bg-emerald-950/40',
          label: 'đơn đơn vị đã ký xong trong tháng',
        },
        {
          title: 'Tổng trong phạm vi',
          value: stats?.totalSubmissions ?? 0,
          icon: <FileTextOutlined className="text-blue-600 dark:text-blue-400" />,
          colorClass: 'bg-blue-50 dark:bg-blue-950/40',
          label: 'tất cả đơn thuộc đơn vị theo dõi',
        },
      ]
    : [
        {
          title: 'Tổng số hồ sơ',
          value: stats?.totalSubmissions ?? 0,
          icon: <FileTextOutlined className="text-blue-600 dark:text-blue-400" />,
          colorClass: 'bg-blue-50 dark:bg-blue-950/40',
          label: 'tất cả hồ sơ trong hệ thống',
        },
        {
          title: 'Hồ sơ chờ duyệt',
          value: stats?.pendingApprovals ?? 0,
          icon: <ClockCircleOutlined className="text-amber-600 dark:text-amber-400" />,
          colorClass: 'bg-amber-50 dark:bg-amber-950/40',
          label: 'đang chờ hoặc đang xử lý',
        },
        {
          title: 'Hồ sơ đã duyệt',
          value: stats?.completedThisMonth ?? 0,
          icon: <CheckCircleOutlined className="text-emerald-500 dark:text-emerald-400" />,
          colorClass: 'bg-emerald-50 dark:bg-emerald-950/40',
          label: 'đã hoàn thành phê duyệt',
        },
        {
          title: 'Hồ sơ bị từ chối',
          value: stats?.rejectedCount ?? 0,
          icon: <CloseCircleOutlined className="text-rose-500 dark:text-rose-400" />,
          colorClass: 'bg-rose-50 dark:bg-rose-950/40',
          label: 'bị từ chối trong quy trình',
        },
        {
          title: 'Tổng người dùng',
          value: stats?.totalUsers ?? 0,
          icon: <UserOutlined className="text-[var(--app-accent)]" />,
          colorClass: 'bg-[var(--app-accent-soft)]',
          label: 'tài khoản đang hoạt động',
        },
      ];

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-6 transition-opacity ${
        loading && stats ? 'opacity-70' : ''
      }`}
    >
      {cards.map((stat) => (
        <StatCard key={stat.title} {...stat} />
      ))}
    </div>
  );
}
