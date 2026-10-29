import { message, notification } from 'antd';
import type { ImportError } from '../types/organization.types';

const uniqueValues = (errors: ImportError[], key: keyof NonNullable<ImportError['detail']>) =>
  [...new Set(errors.map((e) => e.detail?.[key]).filter(Boolean) as string[])];

/** Đổi message kỹ thuật thành hướng dẫn người dùng có thể làm theo. */
export const humanizeImportMessage = (raw?: string): string => {
  if (!raw) return 'Dữ liệu không hợp lệ.';
  const text = raw.trim();

  if (/@student\.ctut\.edu\.vn/i.test(text) && !/@student\.ctuet\.edu\.vn/i.test(text)) {
    return (
      'Email đang dùng đuôi @student.ctut.edu.vn (thiếu chữ e). ' +
      'Sửa thành @student.ctuet.edu.vn (ví dụ: ten@student.ctuet.edu.vn) rồi import lại.'
    );
  }

  if (/@student\.ctuet\.edu\.vn/i.test(text) || /đuôi @student/i.test(text)) {
    return (
      'Email sinh viên phải đúng đuôi @student.ctuet.edu.vn ' +
      '(ví dụ: sv240801.khang@student.ctuet.edu.vn). ' +
      'Lưu ý: không viết nhầm thành @student.ctut.edu.vn (thiếu chữ e).'
    );
  }

  if (/email không đúng định dạng/i.test(text)) {
    return 'Email không đúng định dạng. Kiểm tra lại cột Email (ví dụ: ten@gmail.com).';
  }

  if (/email.*đã tồn tại|đã được sử dụng/i.test(text)) {
    return 'Email này đã có trong hệ thống. Đổi email khác hoặc bỏ qua dòng trùng.';
  }

  if (/mã sv.*đã tồn tại|mã gv.*đã tồn tại|mã lớp.*đã tồn tại|mã.*đã tồn tại/i.test(text)) {
    return `${text} Nếu muốn cập nhật bản ghi cũ, giữ đúng mã đã có trong hệ thống.`;
  }

  if (/ký tự đặc biệt/i.test(text)) {
    return `${text} Chỉ dùng chữ, số, khoảng trắng và gạch ngang (vd. Khoa Điện – Điện tử).`;
  }

  if (/niên khóa|năm học/i.test(text) && /4 chữ số/i.test(text)) {
    return 'Niên khóa/Năm học phải gồm đúng 4 chữ số (ví dụ: 2024).';
  }

  if (/số điện thoại|phone/i.test(text)) {
    return (
      'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567). ' +
      'Chỉ nhập số, không khoảng trắng hay dấu gạch.'
    );
  }

  if (/cccd|cmnd/i.test(text)) {
    return 'Số CCCD/CMND phải gồm 9 số (CMND cũ) hoặc 12 số (CCCD).';
  }

  if (/tài khoản/i.test(text) && /(chữ số|6 đến 20|6-20)/i.test(text)) {
    return 'Số tài khoản chỉ gồm chữ số, từ 6 đến 20 ký tự.';
  }

  if (/năm sinh/i.test(text) && /4 chữ số/i.test(text)) {
    return text;
  }

  if (/không tìm thấy lớp/i.test(text)) {
    return (
      `${text} ` +
      'Cột Lớp cố vấn nên dùng mã lớp (ví dụ HTTT20), hoặc đúng tên lớp đã có. ' +
      'Nhiều lớp cách nhau bằng dấu phẩy. Có thể để trống cột này rồi gán sau trên form.'
    );
  }

  if (/một hoặc nhiều lớp cố vấn không tồn tại/i.test(text)) {
    return 'Một số lớp cố vấn đã chọn không còn tồn tại. Mở lại form, chọn lại lớp rồi lưu.';
  }

  if (/thiếu email/i.test(text)) {
    return 'Thiếu Email. Điền cột Email cho dòng này.';
  }

  if (/thiếu mã sv|thiếu.*họ tên/i.test(text)) {
    return 'Thiếu Mã SV hoặc Họ tên. Kiểm tra lại 2 cột bắt buộc này.';
  }

  if (/thiếu mã gv/i.test(text)) {
    return 'Thiếu Mã GV hoặc Họ tên. Kiểm tra lại các cột bắt buộc.';
  }

  if (/thiếu mã hoặc tên khoa/i.test(text)) {
    return 'Thiếu Mã khoa hoặc Tên khoa trên dòng này.';
  }

  if (/thiếu mã hoặc tên bộ môn/i.test(text)) {
    return 'Thiếu Mã bộ môn hoặc Tên bộ môn trên dòng này.';
  }

  if (/thiếu mã hoặc tên lớp/i.test(text)) {
    return 'Thiếu Mã lớp hoặc Tên lớp trên dòng này.';
  }

  if (/chưa xác định được lớp|chưa có lớp/i.test(text)) {
    return (
      'Chưa gắn được lớp. Hãy chọn lớp trên trang trước khi import, ' +
      'hoặc điền đúng cột Mã lớp trùng với lớp đã có trong hệ thống.'
    );
  }

  if (/chưa xác định được khoa|chưa có khoa/i.test(text)) {
    return 'Chưa xác định được khoa. Chọn khoa trên trang hoặc điền đúng cột Mã khoa trong file.';
  }

  if (/chưa xác định được bộ môn|chưa có bộ môn/i.test(text)) {
    return (
      'Chưa xác định được bộ môn. Chọn Khoa/Bộ môn trên trang trước khi import, ' +
      'hoặc điền đúng cột Mã bộ môn đã có trong hệ thống.'
    );
  }

  if (/file không đúng loại/i.test(text)) {
    return 'File Excel không đúng loại dữ liệu của trang này. Hãy tải mẫu Excel trên trang rồi điền theo đúng cột.';
  }

  return text;
};

const hintByCode = (code: string, errors: ImportError[]): string | null => {
  switch (code) {
    case 'MISSING_BOMON': {
      const names = uniqueValues(errors, 'name');
      if (names.length === 0) {
        return 'Hãy chọn Khoa và Bộ môn ở bộ lọc phía trên trước khi import.';
      }
      return `Chưa có bộ môn trong hệ thống: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}. Hãy tạo bộ môn trước hoặc sửa mã trong file.`;
    }
    case 'MISSING_KHOA': {
      const names = uniqueValues(errors, 'name');
      if (names.length === 0) {
        return 'Hãy chọn Khoa bên trái trước khi import bộ môn.';
      }
      return `Chưa có khoa trong hệ thống: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}. Hãy tạo khoa trước hoặc sửa mã trong file.`;
    }
    case 'MISSING_LOP': {
      const names = uniqueValues(errors, 'name');
      if (names.length === 0) {
        return 'Hãy chọn Lớp ở danh sách trước khi import sinh viên, hoặc điền đúng cột Mã lớp.';
      }
      return `Chưa có lớp trong hệ thống: ${names.slice(0, 3).join(', ')}${names.length > 3 ? '…' : ''}. Tạo lớp trước hoặc sửa Mã lớp trong file.`;
    }
    case 'MISSING_FIELDS':
      return 'Thiếu cột/giá trị bắt buộc. Mở mẫu Excel trên trang và điền đủ các cột tiêu đề.';
    case 'WRONG_FILE':
      return 'File không đúng loại dữ liệu cho trang này. Hãy tải đúng mẫu Excel rồi thử lại.';
    default:
      return null;
  }
};

const groupByMessage = (errors: ImportError[]) => {
  const map = new Map<string, number[]>();
  for (const err of errors) {
    const key = humanizeImportMessage(err.message);
    const rows = map.get(key) ?? [];
    rows.push(err.row);
    map.set(key, rows);
  }
  return [...map.entries()].map(([msg, rows]) => ({ msg, rows }));
};

const buildDescription = (errors: ImportError[]): string => {
  const codeHints = new Set<string>();
  for (const err of errors) {
    if (!err.code) continue;
    const hint = hintByCode(err.code, errors.filter((e) => e.code === err.code));
    if (hint) codeHints.add(hint);
  }

  const groups = groupByMessage(errors);
  const lines: string[] = [];

  for (const hint of codeHints) {
    lines.push(`• ${hint}`);
  }

  const maxGroups = 4;
  for (const group of groups.slice(0, maxGroups)) {
    const rowPreview = group.rows.slice(0, 5).join(', ');
    const more = group.rows.length > 5 ? `… (+${group.rows.length - 5} dòng)` : '';
    lines.push(`• Dòng ${rowPreview}${more}: ${group.msg}`);
  }

  if (groups.length > maxGroups) {
    lines.push(`• … và ${groups.length - maxGroups} nhóm lỗi khác.`);
  }

  return lines.join('\n');
};

export const showImportFeedback = (success: number, errors: ImportError[]) => {
  const skipped = errors.length;

  if (success > 0 && skipped === 0) {
    message.success(`Đã import thành công ${success} dòng.`);
    return;
  }

  if (success === 0 && skipped === 0) {
    notification.warning({
      message: 'Không có dữ liệu để import',
      description:
        'File trống hoặc không có dòng dữ liệu dưới tiêu đề cột. Hãy tải mẫu Excel, điền ít nhất 1 hàng rồi thử lại.',
      duration: 8,
      placement: 'topRight',
      style: { whiteSpace: 'pre-line' },
    });
    return;
  }

  if (success > 0 && skipped > 0) {
    message.success(`Đã import thành công ${success} dòng.`);
    notification.warning({
      message: `${skipped} dòng chưa import được`,
      description: `${buildDescription(errors)}\n\nSửa các dòng lỗi trong Excel rồi import lại (các dòng đúng đã được lưu).`,
      duration: 12,
      placement: 'topRight',
      style: { whiteSpace: 'pre-line', maxWidth: 480 },
    });
    return;
  }

  notification.error({
    message: 'Chưa import được dòng nào',
    description: `${buildDescription(errors)}\n\nHãy sửa file theo hướng dẫn trên rồi chọn Import Excel lại.`,
    duration: 14,
    placement: 'topRight',
    style: { whiteSpace: 'pre-line', maxWidth: 480 },
  });
};
