import { AppError } from '../errors/AppError.js';
import { errorResponse } from '../utils/apiResponse.js';

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return errorResponse(res, err.message, err.statusCode, err.code, err.details || []);
  }

  if (err.name === 'ValidationError') {
    return errorResponse(res, err.message, 422, 'VALIDATION_ERROR');
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0];
    if (field === 'maGV') {
      return errorResponse(res, 'Mã GV đã tồn tại', 409, 'DUPLICATE_ERROR');
    }
    if (field === 'maSV') {
      return errorResponse(res, 'Mã SV đã tồn tại', 409, 'DUPLICATE_ERROR');
    }
    if (field === 'email') {
      return errorResponse(res, 'Email đã được sử dụng', 409, 'DUPLICATE_ERROR');
    }
    if (field === 'studentId') {
      return errorResponse(
        res,
        'Mã sinh viên đã được sử dụng bởi tài khoản khác',
        409,
        'DUPLICATE_ERROR',
      );
    }
    if (field === 'googleSub') {
      return errorResponse(
        res,
        'Tài khoản Google này đã được liên kết với tài khoản khác',
        409,
        'DUPLICATE_ERROR',
      );
    }
    if (field === 'code' || field?.includes('code')) {
      return errorResponse(res, 'Mã đã tồn tại', 409, 'DUPLICATE_ERROR');
    }
    return errorResponse(res, 'Dữ liệu bị trùng', 409, 'DUPLICATE_ERROR');
  }

  console.error('[Error]', err);
  return errorResponse(res, 'Internal server error', 500, 'INTERNAL_ERROR');
};
