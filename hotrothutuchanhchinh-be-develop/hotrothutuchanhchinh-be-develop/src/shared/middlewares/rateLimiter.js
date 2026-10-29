import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

const tooMany = (message) => ({
  success: false,
  error: { code: 'RATE_LIMIT', message },
});

/** Đã đăng nhập thì đếm theo tài khoản, tránh một IP trường làm nghẽn cả lớp. */
const clientKey = (req) => {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ') && config.jwt.secret) {
    try {
      const decoded = jwt.verify(header.slice(7), config.jwt.secret);
      if (decoded?.id) return `user:${decoded.id}`;
    } catch {
      /* token hỏng: đếm theo IP */
    }
  }
  return `ip:${req.ip || 'unknown'}`;
};

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Quá nhiều lần đăng nhập. Vui lòng thử lại sau.'),
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: tooMany('Quá nhiều yêu cầu. Vui lòng thử lại sau.'),
});

export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: tooMany('Quá nhiều lần làm mới phiên. Vui lòng đăng nhập lại.'),
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: clientKey,
  message: tooMany('Quá nhiều yêu cầu. Vui lòng thử lại sau một phút.'),
});
