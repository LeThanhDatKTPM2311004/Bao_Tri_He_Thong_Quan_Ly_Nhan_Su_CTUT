import multer from 'multer';
import config from '../../config/index.js';
import { ValidationError } from '../../shared/errors/AppError.js';

const storage = multer.memoryStorage();

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

const fileFilter = (_req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new ValidationError('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP'), false);
};

export const avatarUpload = multer({
  storage,
  limits: {
    fileSize: Math.min(config.upload.maxFileSize, 3 * 1024 * 1024),
  },
  fileFilter,
});
