import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { globalLoading } from '@/shared/utils/globalLoading';

const SHOW_DELAY_MS = 400;

/**
 * Hiển thị "Đang tải..." khi có API request đang chạy (admin/cán bộ).
 * Delay ngắn để request nhanh không nhấp nháy.
 */
export function GlobalLoadingIndicator() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;

    return globalLoading.subscribe((count) => {
      if (count > 0) {
        if (showTimer == null && !shown) {
          showTimer = setTimeout(() => {
            shown = true;
            setVisible(true);
            showTimer = undefined;
          }, SHOW_DELAY_MS);
        }
      } else {
        if (showTimer != null) {
          clearTimeout(showTimer);
          showTimer = undefined;
        }
        shown = false;
        setVisible(false);
      }
    });
  }, []);

  if (!visible) return null;

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 z-[1200] h-0.5 overflow-hidden pointer-events-none"
        aria-hidden
      >
        <div className="global-loading-bar h-full w-1/3 bg-[var(--app-accent)]" />
      </div>
      <div
        className="fixed top-3 left-1/2 z-[1200] -translate-x-1/2 flex items-center gap-2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-1.5 shadow-sm pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <Spin indicator={<LoadingOutlined spin style={{ fontSize: 14 }} />} size="small" />
        <span className="text-sm text-[var(--app-text)] whitespace-nowrap">
          Đang tải...
        </span>
      </div>
    </>
  );
}
