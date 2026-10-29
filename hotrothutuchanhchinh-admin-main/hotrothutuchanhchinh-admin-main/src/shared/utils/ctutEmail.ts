/** Chấp nhận @student.ctuet.edu.vn */
export const CTUT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@student\.ctuet\.edu\.vn$/i;
export const STANDARD_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const CTUT_EMAIL_MESSAGE =
  'Email sinh viên phải dùng đuôi @student.ctuet.edu.vn (ví dụ: sv240801.khang@student.ctuet.edu.vn). Không viết nhầm @student.ctut.edu.vn';
export const STANDARD_EMAIL_MESSAGE = 'Email không đúng định dạng';

export function isValidStandardEmail(email: string): boolean {
  if (!email?.trim()) return false;
  return STANDARD_EMAIL_REGEX.test(email.trim());
}

export function isValidCtutEmail(email: string): boolean {
  if (!email?.trim()) return false;
  return CTUT_EMAIL_REGEX.test(email.trim());
}

export const standardEmailRule = {
  validator: (_: unknown, value: string) =>
    isValidStandardEmail(value)
      ? Promise.resolve()
      : Promise.reject(new Error(STANDARD_EMAIL_MESSAGE)),
};

export const ctutEmailRule = {
  validator: (_: unknown, value: string) =>
    isValidCtutEmail(value)
      ? Promise.resolve()
      : Promise.reject(new Error(CTUT_EMAIL_MESSAGE)),
};

export const optionalCtutEmailRule = {
  validator: (_: unknown, value: unknown) => {
    if (value == null || value === '' || !String(value).trim()) {
      return Promise.resolve();
    }
    return isValidCtutEmail(String(value))
      ? Promise.resolve()
      : Promise.reject(new Error(CTUT_EMAIL_MESSAGE));
  },
};
