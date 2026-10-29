import { List, Tag } from 'antd';
import type { Notification } from '../types/notifications.types';
import { formatDateTime } from '@/shared/utils/formatDate';

interface NotificationListProps {
  notifications: Notification[];
}

export function NotificationList({ notifications }: NotificationListProps) {
  return (
    <List
      className="min-w-0"
      dataSource={notifications}
      renderItem={(item) => (
        <List.Item className="!items-start gap-2 sm:gap-4">
          <List.Item.Meta
            className="min-w-0 flex-1"
            title={
              <div className="app-break-words flex flex-wrap items-start gap-1.5">
                {!item.isRead && <Tag color="blue">Mới</Tag>}
                <span className="font-medium text-[var(--app-text)]">{item.title}</span>
              </div>
            }
            description={
              <div className="app-break-words text-[var(--app-text-muted)] mt-1">{item.message}</div>
            }
          />
          <span className="text-[var(--app-text-muted)] text-xs sm:text-sm shrink-0 whitespace-nowrap">
            {formatDateTime(item.createdAt)}
          </span>
        </List.Item>
      )}
    />
  );
}
