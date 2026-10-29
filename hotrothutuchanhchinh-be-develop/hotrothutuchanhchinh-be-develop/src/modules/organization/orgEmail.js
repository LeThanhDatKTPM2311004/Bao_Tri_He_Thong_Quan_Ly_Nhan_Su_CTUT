import SinhVien from './models/sinhVien.model.js';
import GiangVien from './models/giangVien.model.js';
import User from '../users/user.model.js';
import { ValidationError } from '../../shared/errors/AppError.js';

export const assertUniqueOrgEmail = async (
  email,
  { excludeSinhVienId, excludeGiangVienId, excludeUserId } = {},
) => {
  const normalized = String(email).trim().toLowerCase();
  const sinhVienFilter = { email: normalized };
  const giangVienFilter = { email: normalized };

  if (excludeSinhVienId) {
    sinhVienFilter._id = { $ne: excludeSinhVienId };
  }
  if (excludeGiangVienId) {
    giangVienFilter._id = { $ne: excludeGiangVienId };
  }

  const [sinhVien, giangVien, user] = await Promise.all([
    SinhVien.findOne(sinhVienFilter).select('_id'),
    GiangVien.findOne(giangVienFilter).select('_id'),
    User.findOne({
      email: normalized,
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    }).select('_id sinhVienId giangVienId'),
  ]);

  if (sinhVien || giangVien) {
    throw new ValidationError(`Email ${normalized} đã được sử dụng`);
  }

  if (user) {
    const linkedToSameSinhVien =
      excludeSinhVienId && user.sinhVienId?.toString() === String(excludeSinhVienId);
    const linkedToSameGiangVien =
      excludeGiangVienId && user.giangVienId?.toString() === String(excludeGiangVienId);
    if (!linkedToSameSinhVien && !linkedToSameGiangVien) {
      throw new ValidationError(`Email ${normalized} đã được sử dụng`);
    }
  }
};
