import axios from 'axios';
import type { ApiError } from '@/shared/types/api.types';

const MESSAGE_ALIASES: Record<string, string> = {
  'Invalid credentials': 'Sai mật khẩu. Kiểm tra lại email/mật khẩu rồi thử đăng nhập.',
  'Mật khẩu hiện tại không đúng': 'Mật khẩu hiện tại không đúng. Nhập lại mật khẩu đang dùng.',
  'Tài khoản đã bị vô hiệu hóa': 'Tài khoản đã bị khóa. Liên hệ quản trị viên để mở lại.',
  'Email phải sử dụng đuôi @student.ctuet.edu.vn':
    'Email sinh viên phải dùng đuôi @student.ctuet.edu.vn (ví dụ: sv240801.khang@student.ctuet.edu.vn). Không viết nhầm @student.ctut.edu.vn',
  'Số điện thoại chỉ được nhập số, tối đa 11 ký tự':
    'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567)',
  'Số điện thoại chỉ được nhập số':
    'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567)',
  'Network Error': 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  'Request failed with status code 401': 'Phiên đăng nhập hết hạn. Đăng nhập lại để tiếp tục.',
  'Request failed with status code 403': 'Bạn không có quyền thực hiện thao tác này.',
  'Request failed with status code 404': 'Không tìm thấy dữ liệu yêu cầu. Làm mới trang rồi thử lại.',
  'Request failed with status code 413': 'File quá lớn. Giảm kích thước file rồi thử lại.',
  'Request failed with status code 500': 'Máy chủ gặp sự cố. Thử lại sau ít phút.',
};

/** Một số lỗi phổ biến: gợi ý cách sửa thay vì chỉ báo lỗi kỹ thuật. */
const humanizeLooseMessage = (message: string): string => {
  if (/@student\.ctut\.edu\.vn/i.test(message) && !/@student\.ctuet\.edu\.vn/i.test(message)) {
    return (
      'Email đang dùng đuôi @student.ctut.edu.vn (thiếu chữ e). ' +
      'Sửa thành @student.ctuet.edu.vn rồi thử lại.'
    );
  }
  if (/đuôi @student\.ctuet|@student\.ctuet\.edu\.vn/i.test(message)) {
    return (
      MESSAGE_ALIASES['Email phải sử dụng đuôi @student.ctuet.edu.vn'] ?? message
    );
  }
  if (/số điện thoại|phone/i.test(message) && /(11 ký tự|chỉ được nhập số|chỉ gồm chữ số)/i.test(message)) {
    return 'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567)';
  }
  if (/E11000|duplicate key/i.test(message)) {
    return 'Dữ liệu bị trùng (mã hoặc email đã tồn tại). Kiểm tra lại rồi đổi giá trị trùng.';
  }
  if (/Cast to ObjectId failed|invalid.*ObjectId/i.test(message)) {
    return 'Mã bản ghi không hợp lệ. Làm mới trang rồi chọn lại.';
  }
  if (/jwt expired|token.*expired|invalid token/i.test(message)) {
    return 'Phiên đăng nhập hết hạn. Đăng nhập lại để tiếp tục.';
  }
  if (/file.*too large|payload too large/i.test(message)) {
    return 'File quá lớn. Giảm kích thước file rồi thử lại.';
  }
  if (/chỉ chấp nhận file|chỉ hỗ trợ file|mimetype|file type/i.test(message)) {
    return 'Định dạng file không được hỗ trợ. Dùng đúng loại file hệ thống yêu cầu (.xlsx, .pdf…).';
  }
  return message;
};

const normalizeMessage = (message?: string) => {
  if (!message) return undefined;
  const aliased = MESSAGE_ALIASES[message];
  if (aliased) return aliased;
  return humanizeLooseMessage(message);
};

const extractApiMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') return undefined;

  const payload = data as ApiError & { message?: string };
  return normalizeMessage(payload.error?.message ?? payload.message);
};

export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return normalizeMessage(error) ?? error;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        const url = String(error.config?.url || '');
        if (/forgot|reset-password|otp/i.test(url)) {
          return 'Máy chủ phản hồi quá chậm. Nếu đang dùng quên mật khẩu, kiểm tra BREVO_API_KEY trên Render.';
        }
        return 'Máy chủ phản hồi quá chậm. Thử lại sau.';
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return 'Mất kết nối mạng';
      }
      return 'Không thể kết nối đến máy chủ';
    }

    const apiMessage = extractApiMessage(error.response?.data);
    if (apiMessage) return apiMessage;
  }

  if (error && typeof error === 'object' && 'response' in error) {
    const apiMessage = extractApiMessage(
      (error as { response?: { data?: unknown } }).response?.data,
    );
    if (apiMessage) return apiMessage;
  }

  if (error instanceof Error && error.message && error.message !== 'Rejected') {
    return normalizeMessage(error.message) ?? error.message;
  }

  return 'Đã xảy ra lỗi';
}
