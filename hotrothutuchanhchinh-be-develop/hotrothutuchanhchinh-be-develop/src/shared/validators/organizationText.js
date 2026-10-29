import { ValidationError } from '../errors/AppError.js';

export const ORG_FIELD_MAX_LENGTH = 100;
export const ORG_CODE_MAX_LENGTH = 15;
export const ORG_CODE_REGEX = /^[A-Za-z0-9]+$/;
/** Chữ/số/dấu tiếng Việt + khoảng trắng + gạch ngang (- – —), vd. "Khoa Điện – Điện tử" */
export const ORG_NAME_REGEX = /^[a-zA-Z0-9\u00C0-\u1EF9\s\-–—]+$/;

export const stripAllWhitespace = (value) =>
  typeof value === 'string' ? value.replace(/\s/g, '') : String(value ?? '').replace(/\s/g, '');

export const normalizeOrgCode = (value) => stripAllWhitespace(value).toUpperCase();

export const assertNonBlankText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${label} không được chỉ chứa khoảng trắng`);
  }
};

export const assertMaxLength = (value, label, max = ORG_FIELD_MAX_LENGTH) => {
  if (typeof value === 'string' && value.length > max) {
    throw new ValidationError(`${label} tối đa ${max} ký tự`);
  }
};

export const assertMaxLengthOrgCode = (value, label) => {
  assertMaxLength(value, label, ORG_CODE_MAX_LENGTH);
};

export const assertValidOrgCode = (value, label) => {
  if (!ORG_CODE_REGEX.test(value)) {
    throw new ValidationError(`${label} không được chứa ký tự đặc biệt`);
  }
};

export const assertValidOrgName = (value, label) => {
  if (!ORG_NAME_REGEX.test(value)) {
    throw new ValidationError(`${label} không được chứa ký tự đặc biệt`);
  }
};

export const ACADEMIC_YEAR_REGEX = /^\d{4}$/;

export const assertValidAcademicYear = (value, label = 'Niên khóa') => {
  if (value == null || value === '') {
    return;
  }
  const text = String(value).trim();
  if (!text) {
    return;
  }
  if (!ACADEMIC_YEAR_REGEX.test(text)) {
    throw new ValidationError(`${label} chỉ được nhập 4 chữ số từ 0000 đến 9999`);
  }
};
