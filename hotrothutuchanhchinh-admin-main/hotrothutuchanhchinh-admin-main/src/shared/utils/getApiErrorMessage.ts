import { getErrorMessage } from '@/shared/utils/errorHandler';

/** Wrapper giữ API cũ; ưu tiên message từ getErrorMessage (mạng + error.message). */
export const getApiErrorMessage = (err: unknown, fallback: string) => {
  const message = getErrorMessage(err);
  if (!message || message === 'Đã xảy ra lỗi') {
    return fallback;
  }
  return message;
};
