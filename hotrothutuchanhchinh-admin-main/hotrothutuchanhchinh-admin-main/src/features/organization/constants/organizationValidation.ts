import { createMaxLengthRule } from '@/shared/utils/formInput';

export const ORG_FIELD_MAX_LENGTH = 100;
export const ORG_CODE_MAX_LENGTH = 15;
export const ORG_CODE_PATTERN = /^[A-Za-z0-9]+$/;
/** Chữ/số/dấu tiếng Việt + khoảng trắng + gạch ngang (- – —), vd. "Khoa Điện – Điện tử" */
export const ORG_NAME_PATTERN = /^[a-zA-Z0-9\u00C0-\u1EF9\s\-–—]+$/;

export const orgFieldMaxLengthRule = createMaxLengthRule(ORG_FIELD_MAX_LENGTH);
export const orgCodeMaxLengthRule = createMaxLengthRule(ORG_CODE_MAX_LENGTH);

export const createOrgCodePatternRule = (label: string) => ({
  pattern: ORG_CODE_PATTERN,
  message: `${label} không được chứa ký tự đặc biệt`,
});

export const createOrgNamePatternRule = (label: string) => ({
  pattern: ORG_NAME_PATTERN,
  message: `${label} không được chứa ký tự đặc biệt`,
});

export const ACADEMIC_YEAR_LENGTH = 4;
export const ACADEMIC_YEAR_PATTERN = /^\d{4}$/;

export const academicYearRule = {
  validator(_: unknown, value: unknown) {
    if (value == null || value === '') {
      return Promise.resolve();
    }
    const text = String(value).trim();
    if (!text) {
      return Promise.resolve();
    }
    if (!ACADEMIC_YEAR_PATTERN.test(text)) {
      return Promise.reject(new Error('Niên khóa chỉ được nhập 4 chữ số từ 0000 đến 9999'));
    }
    return Promise.resolve();
  },
};

export const createOrgCodeDuplicateRule = (
  label: string,
  existingCodes: string[],
  isEditing = false,
) => ({
  validator(_: unknown, value: unknown) {
    if (isEditing) {
      return Promise.resolve();
    }
    const code = String(value ?? '').trim().toUpperCase();
    if (!code) {
      return Promise.resolve();
    }
    if (existingCodes.includes(code)) {
      return Promise.reject(new Error(`${label} ${code} đã tồn tại`));
    }
    return Promise.resolve();
  },
});

export const createOrgEmailDuplicateRule = (existingEmails: string[], currentEmail?: string) => ({
  validator(_: unknown, value: unknown) {
    const email = String(value ?? '').trim().toLowerCase();
    if (!email) {
      return Promise.resolve();
    }
    if (currentEmail && email === currentEmail.trim().toLowerCase()) {
      return Promise.resolve();
    }
    if (existingEmails.includes(email)) {
      return Promise.reject(new Error(`Email ${email} đã được sử dụng`));
    }
    return Promise.resolve();
  },
});
