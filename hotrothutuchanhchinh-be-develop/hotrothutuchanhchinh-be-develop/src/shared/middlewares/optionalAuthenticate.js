import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

/** Gắn req.user nếu có Bearer token hợp lệ; không có token thì vẫn cho qua (FAQ công khai). */
export const optionalAuthenticate = (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }
    const token = authHeader.split(' ')[1];
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch {
    return next();
  }
};
