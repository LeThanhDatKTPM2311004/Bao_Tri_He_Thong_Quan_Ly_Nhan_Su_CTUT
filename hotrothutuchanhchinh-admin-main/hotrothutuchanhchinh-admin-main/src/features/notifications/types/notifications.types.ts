export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  /** Đường dẫn file đơn (enrich từ BE) */
  fileUrl?: string | null;
  formName?: string | null;
  canViewFile?: boolean;
}
