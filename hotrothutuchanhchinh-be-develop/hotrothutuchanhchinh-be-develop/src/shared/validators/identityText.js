import { ValidationError } from '../errors/AppError.js';

/** CCCD mới 12 số hoặc CMND cũ 9 số */
export const CCCD_REGEX = /^(\d{9}|\d{12})$/;
export const CCCD_MESSAGE =
  'Số CCCD/CMND phải gồm 9 số (CMND cũ) hoặc 12 số (CCCD), chỉ được nhập chữ số';

export const BANK_ACCOUNT_MIN = 6;
export const BANK_ACCOUNT_MAX = 20;
export const BANK_ACCOUNT_REGEX = /^\d{6,20}$/;
export const BANK_ACCOUNT_MESSAGE =
  'Số tài khoản chỉ gồm chữ số, từ 6 đến 20 ký tự';

export const BIRTH_YEAR_MIN = 1900;
export const BIRTH_YEAR_REGEX = /^\d{4}$/;

export const normalizeDigits = (value, maxLength) => {
  if (value == null || value === '') return '';
  const digits = String(value).replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

export const assertValidCccdIfProvided = (value) => {
  const normalized = normalizeDigits(value, 12);
  if (!normalized) return '';
  if (!CCCD_REGEX.test(normalized)) {
    throw new ValidationError(CCCD_MESSAGE, [{ field: 'soCCCD', message: CCCD_MESSAGE }]);
  }
  return normalized;
};

export const assertValidBankAccountIfProvided = (value) => {
  const normalized = normalizeDigits(value, BANK_ACCOUNT_MAX);
  if (!normalized) return '';
  if (!BANK_ACCOUNT_REGEX.test(normalized)) {
    throw new ValidationError(BANK_ACCOUNT_MESSAGE, [
      { field: 'soTaiKhoan', message: BANK_ACCOUNT_MESSAGE },
    ]);
  }
  return normalized;
};

export const birthYearMessage = (label = 'Năm sinh') =>
  `${label} phải gồm đúng 4 chữ số từ ${BIRTH_YEAR_MIN} đến ${new Date().getFullYear()}`;

export const assertValidBirthYearIfProvided = (value, label = 'Năm sinh') => {
  const normalized = normalizeDigits(value, 4);
  if (!normalized) return '';
  const year = Number(normalized);
  const max = new Date().getFullYear();
  if (!BIRTH_YEAR_REGEX.test(normalized) || year < BIRTH_YEAR_MIN || year > max) {
    const message = birthYearMessage(label);
    throw new ValidationError(message, [{ field: 'namSinh', message }]);
  }
  return normalized;
};

/** Chuẩn hóa các trường số/năm trên hồ sơ SV (create/update/import). */
export const normalizeSinhVienIdentityFields = (data = {}) => {
  const out = {};
  if (Object.prototype.hasOwnProperty.call(data, 'soCCCD')) {
    out.soCCCD = assertValidCccdIfProvided(data.soCCCD);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'soTaiKhoan')) {
    out.soTaiKhoan = assertValidBankAccountIfProvided(data.soTaiKhoan);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'namSinhCha')) {
    out.namSinhCha = assertValidBirthYearIfProvided(data.namSinhCha, 'Năm sinh (cha)');
  }
  if (Object.prototype.hasOwnProperty.call(data, 'namSinhMe')) {
    out.namSinhMe = assertValidBirthYearIfProvided(data.namSinhMe, 'Năm sinh (mẹ)');
  }
  return out;
};
