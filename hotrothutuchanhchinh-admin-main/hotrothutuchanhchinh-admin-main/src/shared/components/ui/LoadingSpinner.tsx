import { Spin } from 'antd';

export function LoadingSpinner({ tip = 'Đang tải...' }: { tip?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Spin size="large" tip={tip}>
        <div className="p-8" />
      </Spin>
    </div>
  );
}
