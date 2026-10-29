import { ValidationError } from '../errors/AppError.js';

export const PHONE_MIN_LENGTH = 10;
export const PHONE_MAX_LENGTH = 11;
/** Số VN: bắt đầu bằng 0, tổng 10–11 chữ số (vd: 0901234567) */
export const PHONE_REGEX = /^0\d{9,10}$/;

export const PHONE_INVALID_MESSAGE =
  'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567)';

export const normalizePhone = (value) => {
  if (value == null || value === '') {
    return '';
  }
  return String(value).replace(/\D/g, '').slice(0, PHONE_MAX_LENGTH);
};

export const isValidPhone = (phone) => {
  if (phone == null || phone === '') {
    return true;
  }
  return PHONE_REGEX.test(String(phone));
};

export const assertValidPhoneIfProvided = (phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) {
    return '';
  }
  if (!isValidPhone(normalized)) {
    throw new ValidationError(PHONE_INVALID_MESSAGE, [
      { field: 'phone', message: PHONE_INVALID_MESSAGE },
    ]);
  }
  return normalized;
};
