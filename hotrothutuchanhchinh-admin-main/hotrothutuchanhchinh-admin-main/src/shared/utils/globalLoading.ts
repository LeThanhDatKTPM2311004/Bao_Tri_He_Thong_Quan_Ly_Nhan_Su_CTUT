type Listener = (pendingCount: number) => void;

let pendingCount = 0;
const listeners = new Set<Listener>();

const notify = () => {
  listeners.forEach((listener) => listener(pendingCount));
};

/** Bộ đếm request API đang chạy — dùng cho overlay "Đang tải...". */
export const globalLoading = {
  start() {
    pendingCount += 1;
    notify();
  },
  end() {
    pendingCount = Math.max(0, pendingCount - 1);
    notify();
  },
  getCount() {
    return pendingCount;
  },
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(pendingCount);
    return () => {
      listeners.delete(listener);
    };
  },
};
