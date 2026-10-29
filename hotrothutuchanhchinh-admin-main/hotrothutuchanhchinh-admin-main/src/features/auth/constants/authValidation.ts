/** Email @student.ctuet.edu.vn có thể dài (VD cố vấn học tập). */
export const AUTH_INPUT_MAX_LENGTH = 80;

export const authInputMaxLengthRule = {
  max: AUTH_INPUT_MAX_LENGTH,
  message: `Tối đa ${AUTH_INPUT_MAX_LENGTH} ký tự`,
};
