import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 8000;

/** Tải lại dữ liệu khi quay lại tab và định kỳ lúc trang đang hiện. */
export function useLiveRefresh(refresh: () => void | Promise<void>, intervalMs = DEFAULT_INTERVAL_MS) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    let running = false;

    const run = () => {
      if (document.visibilityState === 'hidden' || running) return;
      const result = refreshRef.current?.();
      if (result && typeof (result as Promise<void>).then === 'function') {
        running = true;
        (result as Promise<void>).finally(() => {
          running = false;
        });
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };

    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
