import { ValidationError } from '../errors/AppError.js';

/** Email chuẩn thông thường */
export const STANDARD_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

/** Chấp nhận @student.ctuet.edu.vn */
export const CTUT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@student\.ctuet\.edu\.vn$/i;

export const CTUT_EMAIL_MESSAGE =
  'Email sinh viên phải dùng đuôi @student.ctuet.edu.vn (ví dụ: sv240801.khang@student.ctuet.edu.vn). Không viết nhầm @student.ctut.edu.vn';

export const STANDARD_EMAIL_MESSAGE = 'Email không đúng định dạng';

export const isValidStandardEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return STANDARD_EMAIL_REGEX.test(email.trim());
};

export const isValidCtutEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  return CTUT_EMAIL_REGEX.test(email.trim());
};

export const assertStandardEmail = (email) => {
  if (!isValidStandardEmail(email)) {
    throw new ValidationError(STANDARD_EMAIL_MESSAGE, [
      { field: 'email', message: STANDARD_EMAIL_MESSAGE },
    ]);
  }
};

export const assertCtutEmail = (email) => {
  if (!isValidCtutEmail(email)) {
    throw new ValidationError(CTUT_EMAIL_MESSAGE, [
      { field: 'email', message: CTUT_EMAIL_MESSAGE },
    ]);
  }
};

export const assertCtutEmailIfProvided = (email) => {
  if (email == null || email === '' || !String(email).trim()) {
    return;
  }
  assertCtutEmail(email);
};
