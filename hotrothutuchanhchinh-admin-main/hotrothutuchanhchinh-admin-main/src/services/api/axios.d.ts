import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Overlay "Đang tải...":
     * - true: luôn tắt
     * - false: luôn bật (kể cả GET, vd. export dài)
     * - mặc định: tắt với GET/HEAD, bật với POST/PUT/PATCH/DELETE
     */
    skipGlobalLoading?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    skipGlobalLoading?: boolean;
    __globalLoadingTracked?: boolean;
  }
}

export {};
