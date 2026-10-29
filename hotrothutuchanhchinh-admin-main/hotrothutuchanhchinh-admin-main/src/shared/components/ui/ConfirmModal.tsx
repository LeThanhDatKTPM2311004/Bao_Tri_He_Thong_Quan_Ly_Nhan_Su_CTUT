import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmModalOptions {
  title: string;
  content?: string;
  onOk: () => void | Promise<void>;
}

export function showConfirmModal({ title, content, onOk }: ConfirmModalOptions) {
  Modal.confirm({
    title,
    content,
    icon: <ExclamationCircleOutlined />,
    okText: 'Xác nhận',
    cancelText: 'Hủy',
    onOk,
  });
}
