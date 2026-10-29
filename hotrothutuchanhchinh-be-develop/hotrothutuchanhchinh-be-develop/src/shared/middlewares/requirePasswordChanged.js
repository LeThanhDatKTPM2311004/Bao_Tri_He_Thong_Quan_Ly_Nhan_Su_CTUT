import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import User from '../../modules/users/user.model.js';
import { AppError } from '../errors/AppError.js';

const ALLOWED = new Set([
  'GET /auth/me',
  'POST /auth/logout',
  'POST /auth/refresh',
  'GET /users/me',
  'PATCH /users/me/password',
]);

/** Chặn API khác cho đến khi tài khoản đổi mật khẩu mặc định. */
export const blockUntilPasswordChanged = async (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();

  let decoded;
  try {
    decoded = jwt.verify(header.slice(7), config.jwt.secret);
  } catch {
    return next();
  }

  const key = `${req.method} ${req.path}`;
  if (ALLOWED.has(key)) return next();

  const user = await User.findById(decoded.id).select('mustChangePassword');
  if (!user?.mustChangePassword) return next();

  return next(
    new AppError(
      'Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống',
      403,
      'MUST_CHANGE_PASSWORD',
    ),
  );
};
