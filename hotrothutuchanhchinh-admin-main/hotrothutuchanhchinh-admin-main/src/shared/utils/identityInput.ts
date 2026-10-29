import dayjs, { type Dayjs } from 'dayjs';
import { restrictDigitsInput } from './formInput';

export const DATE_DISPLAY_FORMAT = 'DD/MM/YYYY';
export const BIRTH_YEAR_MIN = 1900;
export const CCCD_MAX_LENGTH = 12;
export const BANK_ACCOUNT_MIN = 6;
export const BANK_ACCOUNT_MAX = 20;

export const CCCD_MESSAGE =
  'Số CCCD/CMND phải gồm 9 số (CMND cũ) hoặc 12 số (CCCD), chỉ được nhập chữ số';
export const BANK_ACCOUNT_MESSAGE =
  'Số tài khoản chỉ gồm chữ số, từ 6 đến 20 ký tự';

export const normalizeCccdInput = (value: unknown) =>
  restrictDigitsInput(value, CCCD_MAX_LENGTH);

export const normalizeBankAccountInput = (value: unknown) =>
  restrictDigitsInput(value, BANK_ACCOUNT_MAX);

export const normalizeBirthYearInput = (value: unknown) => restrictDigitsInput(value, 4);

export const optionalCccdRule = {
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') return Promise.resolve();
    const text = String(value);
    if (!/^(\d{9}|\d{12})$/.test(text)) {
      return Promise.reject(new Error(CCCD_MESSAGE));
    }
    return Promise.resolve();
  },
};

export const optionalBankAccountRule = {
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') return Promise.resolve();
    const text = String(value);
    if (!/^\d{6,20}$/.test(text)) {
      return Promise.reject(new Error(BANK_ACCOUNT_MESSAGE));
    }
    return Promise.resolve();
  },
};

export const createOptionalBirthYearRule = (label = 'Năm sinh') => ({
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') return Promise.resolve();
    const text = String(value);
    const year = Number(text);
    const max = dayjs().year();
    if (!/^\d{4}$/.test(text) || year < BIRTH_YEAR_MIN || year > max) {
      return Promise.reject(
        new Error(`${label} phải gồm đúng 4 chữ số từ ${BIRTH_YEAR_MIN} đến ${max}`),
      );
    }
    return Promise.resolve();
  },
});

/** Không cho chọn ngày trong tương lai */
export const disableFutureDate = (current: Dayjs | null) =>
  !!current && current.isAfter(dayjs(), 'day');

/** Ngày sinh: không tương lai, không trước 1900 */
export const disableDateOfBirth = (current: Dayjs | null) => {
  if (!current) return false;
  if (current.isAfter(dayjs(), 'day')) return true;
  if (current.year() < BIRTH_YEAR_MIN) return true;
  return false;
};

/** Ngày cấp / vào đoàn-đảng / vào trường: không tương lai, từ 1900 */
export const disableHistoricalDate = (current: Dayjs | null) => {
  if (!current) return false;
  if (current.isAfter(dayjs(), 'day')) return true;
  if (current.year() < BIRTH_YEAR_MIN) return true;
  return false;
};
