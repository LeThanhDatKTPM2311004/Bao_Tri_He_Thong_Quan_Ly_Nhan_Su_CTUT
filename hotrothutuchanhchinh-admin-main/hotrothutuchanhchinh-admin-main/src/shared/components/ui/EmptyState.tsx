import { Empty } from 'antd';

interface EmptyStateProps {
  description?: string;
}

export function EmptyState({ description = 'Không có dữ liệu' }: EmptyStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[200px] rounded-xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)]">
      <Empty description={description} />
    </div>
  );
}
