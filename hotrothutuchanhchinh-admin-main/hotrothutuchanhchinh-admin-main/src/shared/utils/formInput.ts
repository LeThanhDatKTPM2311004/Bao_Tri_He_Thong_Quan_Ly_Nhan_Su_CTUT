export const stripAllWhitespace = (value: unknown) =>
  typeof value === 'string' ? value.replace(/\s/g, '') : value;

export const trimInputValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : value;

export const createMaxLengthRule = (max: number) => ({
  max,
  message: `Tối đa ${max} ký tự`,
});

export const restrictDigitsInput = (value: unknown, maxLength: number) =>
  typeof value === 'string' ? value.replace(/\D/g, '').slice(0, maxLength) : value;

export const noWhitespaceOnlyRule = {
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') {
      return Promise.resolve();
    }
    if (typeof value === 'string' && value.length > 0 && value.trim().length === 0) {
      return Promise.reject(new Error('Không được chỉ nhập khoảng trắng'));
    }
    return Promise.resolve();
  },
};
