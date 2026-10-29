import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Empty, List, Space, Spin, Tag, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setNotifications, setUnreadCount } from '../store/notificationsSlice';
import { notificationApi } from '../services/notificationApi';
import { workflowsApi } from '@/features/workflows/services/workflowsApi';
import { formatDateTime } from '@/shared/utils/formatDate';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import type { Notification } from '../types/notifications.types';

const TYPE_LABEL: Record<string, { text: string; color: string }> = {
  signature_required: { text: 'Chờ xử lý', color: 'blue' },
  deadline_warning: { text: 'Quá hạn', color: 'red' },
  submission_approved: { text: 'Hoàn tất', color: 'green' },
  submission_rejected: { text: 'Từ chối', color: 'orange' },
  submission_returned: { text: 'Trả về', color: 'gold' },
  submission_cancelled: { text: 'SV hủy', color: 'default' },
  submission_in_progress: { text: 'Đang xử lý', color: 'processing' },
  submission_created: { text: 'Mới nộp', color: 'cyan' },
  system: { text: 'Hệ thống', color: 'default' },
};

export function NotificationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, unreadCount } = useAppSelector((state) => state.notifications);
  const [loading, setLoading] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, countRes] = await Promise.all([
        notificationApi.getAll(),
        notificationApi.getUnreadCount(),
      ]);
      const list = (listRes.data.data || []) as Notification[];
      dispatch(setNotifications(list));
      dispatch(setUnreadCount(countRes.data.data?.count ?? list.filter((n) => !n.isRead).length));
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không tải được danh sách thông báo');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    void load();
  }, [load]);

  const markReadIfNeeded = async (item: Notification) => {
    if (item.isRead) return;
    try {
      await notificationApi.markAsRead(item._id);
      dispatch(
        setNotifications(items.map((n) => (n._id === item._id ? { ...n, isRead: true } : n))),
      );
      dispatch(setUnreadCount(Math.max(0, unreadCount - 1)));
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không đánh dấu được đã đọc');
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      dispatch(setNotifications(items.map((n) => ({ ...n, isRead: true }))));
      dispatch(setUnreadCount(0));
      message.success('Đã đánh dấu tất cả là đã đọc');
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể đánh dấu đã đọc');
    }
  };

  const openItem = async (item: Notification) => {
    await markReadIfNeeded(item);
    if (
      item.type === 'signature_required' ||
      item.type === 'deadline_warning' ||
      item.type === 'submission_in_progress'
    ) {
      navigate('/workflows/pending');
    } else if (item.type === 'submission_cancelled') {
      navigate('/workflows/processed');
    }
  };

  const handleViewFile = async (item: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    await markReadIfNeeded(item);

    if (!item.fileUrl) {
      message.warning('Hồ sơ này chưa có file đính kèm để xem');
      return;
    }

    try {
      setViewingId(item._id);
      const blob = await workflowsApi.viewSubmissionFile(item.fileUrl);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không thể mở file hồ sơ');
    } finally {
      setViewingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Thông báo"
        
      />
      <Card
        size="small"
        className="border border-[var(--app-border)] bg-[var(--app-surface)] rounded-xl"
        extra={
          <Space>
            <Button onClick={() => void load()} loading={loading}>
              Tải lại
            </Button>
            <Button type="primary" disabled={!unreadCount} onClick={() => void markAll()}>
              Đánh dấu đã đọc tất cả
            </Button>
          </Space>
        }
      >
        {loading && items.length === 0 ? (
          <div className="py-12 flex justify-center">
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty description="Chưa có thông báo nào" />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => {
              const meta = TYPE_LABEL[item.type] || TYPE_LABEL.system;
              const canView = Boolean(item.canViewFile && item.fileUrl);

              return (
                <List.Item
                  className={`cursor-pointer rounded-lg px-3 ${
                    item.isRead ? '' : 'bg-[var(--app-accent-soft)]'
                  }`}
                  onClick={() => void openItem(item)}
                  actions={[
                    canView ? (
                      <Button
                        key="view"
                        type="primary"
                        ghost
                        size="small"
                        icon={<EyeOutlined />}
                        loading={viewingId === item._id}
                        onClick={(e) => void handleViewFile(item, e)}
                      >
                        Xem đơn
                      </Button>
                    ) : (
                      <span key="noview" />
                    ),
                    <span key="time" className="text-[var(--app-text-muted)] text-xs whitespace-nowrap">
                      {formatDateTime(item.createdAt)}
                    </span>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space size={6} wrap>
                        {!item.isRead && <Tag color="blue">Mới</Tag>}
                        <Tag color={meta.color}>{meta.text}</Tag>
                        <span className="font-semibold">{item.title}</span>
                      </Space>
                    }
                    description={<span className="text-[var(--app-text-muted)]">{item.message}</span>}
                  />
                </List.Item>
              );
            }}
          />
        )}
      </Card>
    </div>
  );
}
