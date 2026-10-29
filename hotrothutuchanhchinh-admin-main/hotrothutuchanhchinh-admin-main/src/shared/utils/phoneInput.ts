import { restrictDigitsInput } from './formInput';

export const PHONE_MIN_LENGTH = 10;
export const PHONE_MAX_LENGTH = 11;

export const PHONE_INVALID_MESSAGE =
  'Số điện thoại phải bắt đầu bằng 0, gồm 10–11 chữ số (ví dụ: 0901234567)';

export const normalizePhoneInput = (value: unknown) =>
  restrictDigitsInput(value, PHONE_MAX_LENGTH);

export const optionalPhoneRule = {
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') {
      return Promise.resolve();
    }
    const text = String(value);
    if (!/^0\d{9,10}$/.test(text)) {
      return Promise.reject(new Error(PHONE_INVALID_MESSAGE));
    }
    return Promise.resolve();
  },
};
