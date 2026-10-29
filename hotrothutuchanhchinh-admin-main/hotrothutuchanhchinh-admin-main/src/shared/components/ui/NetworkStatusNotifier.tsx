import { useEffect, useRef } from 'react';
import { Alert, message } from 'antd';
import { WifiOutlined } from '@ant-design/icons';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function NetworkStatusNotifier() {
  const isOnline = useNetworkStatus();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      return;
    }

    if (wasOffline.current) {
      message.success('Đã kết nối lại mạng');
      wasOffline.current = false;
    }
  }, [isOnline]);

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <Alert
        type="error"
        showIcon
        icon={<WifiOutlined />}
        message="Mất kết nối mạng"
        description="Không có kết nối internet. Vui lòng kiểm tra mạng và thử lại."
        banner
      />
    </div>
  );
}
