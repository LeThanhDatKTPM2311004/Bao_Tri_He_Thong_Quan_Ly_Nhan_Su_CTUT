import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge, Button, Empty, List, Popover, Spin, Tag, Typography, message } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setNotifications, setUnreadCount } from '../store/notificationsSlice';
import { notificationApi } from '../services/notificationApi';
import { formatDateTime } from '@/shared/utils/formatDate';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import type { Notification } from '../types/notifications.types';

const TYPE_COLOR: Record<string, string> = {
  signature_required: 'blue',
  deadline_warning: 'red',
  submission_approved: 'green',
  submission_rejected: 'orange',
  submission_cancelled: 'default',
  submission_in_progress: 'processing',
  submission_created: 'cyan',
  submission_returned: 'gold',
  system: 'default',
};

export function NotificationBell() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, unreadCount } = useAppSelector((state) => state.notifications);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadErrorShownRef = useRef(false);

  const loadNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getAll({ limit: 20 }),
        notificationApi.getUnreadCount(),
      ]);
      const list = (listRes.data.data || []) as Notification[];
      dispatch(setNotifications(list));
      dispatch(setUnreadCount(countRes.data.data?.count ?? list.filter((n) => !n.isRead).length));
      loadErrorShownRef.current = false;
    } catch (error) {
      // Poll im lặng; chỉ báo khi mở chuông hoặc lần đầu
      if (!opts?.silent && !loadErrorShownRef.current) {
        message.error(getErrorMessage(error) || 'Không tải được thông báo');
        loadErrorShownRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void loadNotifications();
    const timer = window.setInterval(() => {
      void loadNotifications({ silent: true });
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void loadNotifications();
  };

  const handleClickItem = async (item: Notification) => {
    if (!item.isRead) {
      try {
        await notificationApi.markAsRead(item._id);
        dispatch(
          setNotifications(
            items.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)),
          ),
        );
        dispatch(setUnreadCount(Math.max(0, unreadCount - 1)));
      } catch (error) {
        message.error(getErrorMessage(error) || 'Không đánh dấu được đã đọc');
      }
    }
    setOpen(false);
    if (item.type === 'signature_required' || item.type === 'deadline_warning' || item.type === 'submission_in_progress') {
      navigate('/workflows/pending');
    } else if (item.type === 'submission_cancelled') {
      navigate('/workflows/processed');
    } else {
      navigate('/notifications');
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      dispatch(setNotifications(items.map((n) => ({ ...n, isRead: true }))));
      dispatch(setUnreadCount(0));
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không đánh dấu tất cả được');
    }
  };

  const content = (
    <div className="w-[340px] max-w-[90vw]">
      <div className="flex items-center justify-between mb-2 px-1">
        <Typography.Text strong>Thông báo</Typography.Text>
        <SpaceActions
          onMarkAll={handleMarkAll}
          onViewAll={() => {
            setOpen(false);
            navigate('/notifications');
          }}
          disabled={!unreadCount}
        />
      </div>
      {loading ? (
        <div className="py-8 flex justify-center items-center gap-2 text-[var(--app-text-muted)] text-sm">
          <Spin size="small" />
          Đang tải...
        </div>
      ) : items.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo" />
      ) : (
        <List
          size="small"
          className="max-h-[360px] overflow-y-auto"
          dataSource={items.slice(0, 12)}
          renderItem={(item) => (
            <List.Item
              className={`!px-2 cursor-pointer rounded-lg hover:bg-[var(--app-bg)] ${
                item.isRead ? 'opacity-70' : 'bg-[var(--app-accent-soft)]'
              }`}
              onClick={() => void handleClickItem(item)}
            >
              <List.Item.Meta
                title={
                  <div className="flex flex-wrap items-start gap-1.5 min-w-0">
                    {!item.isRead && <Tag color="blue" className="!m-0 !text-[10px]">Mới</Tag>}
                    <Tag color={TYPE_COLOR[item.type] || 'default'} className="!m-0 !text-[10px]">
                      {item.type === 'deadline_warning'
                        ? 'Quá hạn'
                        : item.type === 'signature_required'
                          ? 'Chờ xử lý'
                          : item.type === 'submission_in_progress'
                            ? 'Đang xử lý'
                            : item.type === 'submission_approved'
                              ? 'Hoàn tất'
                              : item.type === 'submission_rejected'
                                ? 'Từ chối'
                                : item.type === 'submission_cancelled'
                                  ? 'SV hủy'
                                  : 'Hệ thống'}
                    </Tag>
                    <span className="text-xs font-semibold leading-snug app-break-words min-w-0 flex-1">
                      {item.title}
                    </span>
                  </div>
                }
                description={
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs text-[var(--app-text-muted)] line-clamp-3 app-break-words">
                      {item.message}
                    </div>
                    <div className="text-[10px] text-[var(--app-text-muted)]">
                      {formatDateTime(item.createdAt)}
                    </div>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      arrow={{ pointAtCenter: true }}
    >
      <Badge count={unreadCount} size="small" overflowCount={99}>
        <BellOutlined className="text-lg cursor-pointer" aria-label="Thông báo" />
      </Badge>
    </Popover>
  );
}

function SpaceActions({
  onMarkAll,
  onViewAll,
  disabled,
}: {
  onMarkAll: () => void;
  onViewAll: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button type="link" size="small" className="!px-1 !text-xs" disabled={disabled} onClick={onMarkAll}>
        Đọc tất cả
      </Button>
      <Button type="link" size="small" className="!px-1 !text-xs" onClick={onViewAll}>
        Xem tất cả
      </Button>
    </div>
  );
}
