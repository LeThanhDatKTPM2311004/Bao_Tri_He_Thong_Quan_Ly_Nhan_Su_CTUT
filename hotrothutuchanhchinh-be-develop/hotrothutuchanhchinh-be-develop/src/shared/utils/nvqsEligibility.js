/**
 * Điều kiện dùng đơn tạm hoãn NVQS thường / trễ hạn
 * theo tháng dự kiến tốt nghiệp (bảng mã).
 */
import { ForbiddenError, ValidationError } from '../errors/AppError.js';
import { resolveScheduleFromStudent } from './nvqsBangMa.js';

const normText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');

/** @typedef {'nvqs_before_grad' | 'nvqs_after_grad' | null} NvqsEligibilityKind */

/**
 * Nhận diện loại đơn NVQS từ tên / file / cờ LoaiDon.eligibility
 * @returns {NvqsEligibilityKind}
 */
export const resolveNvqsEligibilityKind = (loaiDon = {}) => {
  if (loaiDon.eligibility === 'nvqs_before_grad' || loaiDon.eligibility === 'nvqs_after_grad') {
    return loaiDon.eligibility;
  }

  const blob = normText(
    [loaiDon.tenDon, loaiDon.templateFile, loaiDon.originalFileName, loaiDon.description]
      .filter(Boolean)
      .join(' '),
  );

  const isNvqs =
    blob.includes('nvqs') ||
    blob.includes('tamhoan') ||
    blob.includes('nghiavuquansu');

  if (!isNvqs) return null;

  if (blob.includes('trehan') || blob.includes('quahan')) {
    return 'nvqs_after_grad';
  }

  return 'nvqs_before_grad';
};

/** Cuối tháng mm/yyyy */
export const endOfMonthFromMmYyyy = (value) => {
  const match = String(value || '')
    .trim()
    .match(/^(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (!month || month < 1 || month > 12 || !year) return null;
  return new Date(year, month, 0, 23, 59, 59, 999);
};

export const isPastExpectedGraduation = (thoiGianTotNghiep, now = new Date()) => {
  const end = endOfMonthFromMmYyyy(thoiGianTotNghiep);
  if (!end) return null;
  return now.getTime() > end.getTime();
};

/**
 * @returns {{
 *   kind: NvqsEligibilityKind,
 *   allowed: boolean,
 *   pastGraduation: boolean | null,
 *   thoiGianTotNghiep: string,
 *   message: string,
 * }}
 */
export const evaluateNvqsEligibility = (loaiDon, studentProfile, now = new Date()) => {
  const kind = resolveNvqsEligibilityKind(loaiDon);
  if (!kind) {
    return {
      kind: null,
      allowed: true,
      pastGraduation: null,
      thoiGianTotNghiep: '',
      message: '',
    };
  }

  const schedule = resolveScheduleFromStudent(studentProfile || {});
  if (!schedule?.thoiGianTotNghiep) {
    return {
      kind,
      allowed: false,
      pastGraduation: null,
      thoiGianTotNghiep: '',
      message:
        'Không xác định được thời gian dự kiến tốt nghiệp từ hồ sơ (ngành / khóa / loại hình). Vui lòng cập nhật hồ sơ sinh viên trước khi nộp đơn NVQS.',
    };
  }

  const past = isPastExpectedGraduation(schedule.thoiGianTotNghiep, now);
  const milestone = schedule.thoiGianTotNghiep;

  if (kind === 'nvqs_after_grad') {
    if (past) {
      return {
        kind,
        allowed: true,
        pastGraduation: true,
        thoiGianTotNghiep: milestone,
        message: '',
      };
    }
    return {
      kind,
      allowed: false,
      pastGraduation: false,
      thoiGianTotNghiep: milestone,
      message: `Bạn chưa quá thời gian dự kiến tốt nghiệp (${milestone}). Hãy dùng mẫu Giấy xác nhận tạm hoãn NVQS (không phải mẫu trễ hạn).`,
    };
  }

  // nvqs_before_grad
  if (!past) {
    return {
      kind,
      allowed: true,
      pastGraduation: false,
      thoiGianTotNghiep: milestone,
      message: '',
    };
  }

  return {
    kind,
    allowed: false,
    pastGraduation: true,
    thoiGianTotNghiep: milestone,
    message: `Bạn đã quá thời gian dự kiến tốt nghiệp (${milestone}). Hãy dùng mẫu Giấy xác nhận tạm hoãn NVQS trễ hạn.`,
  };
};

/** Ném lỗi nếu SV không đủ điều kiện dùng loại đơn NVQS này */
export const assertNvqsEligibilityOrThrow = (loaiDon, studentProfile, now = new Date()) => {
  const result = evaluateNvqsEligibility(loaiDon, studentProfile, now);
  if (result.allowed) return result;

  if (!result.thoiGianTotNghiep) {
    throw new ValidationError(result.message);
  }
  throw new ForbiddenError(result.message);
};
