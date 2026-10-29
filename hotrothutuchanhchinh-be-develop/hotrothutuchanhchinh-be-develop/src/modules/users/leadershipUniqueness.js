import User from './user.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { ValidationError } from '../../shared/errors/AppError.js';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Vai trò lãnh đạo độc quyền (chỉ 1 tài khoản đang hoạt động / phạm vi).
 * - Hiệu trưởng: toàn trường
 * - Trưởng khoa: theo khoa
 * - Trưởng bộ môn: theo bộ môn
 * - Trưởng phòng / Giám đốc trung tâm: theo tên Đơn vị / Phòng ban
 */
export const assertExclusiveLeadershipRole = async (userLike, { excludeUserId } = {}) => {
  if (!userLike?.role || userLike.isActive === false) return;

  const role = userLike.role;
  const filter = { role, isActive: true };
  if (excludeUserId) filter._id = { $ne: excludeUserId };

  let scopeLabel = '';

  if (role === ROLES.PRINCIPAL) {
    scopeLabel = 'toàn trường';
  } else if (role === ROLES.FACULTY_MANAGER) {
    if (!userLike.khoaId) {
      throw new ValidationError('Trưởng khoa cần chọn khoa');
    }
    filter.khoaId = userLike.khoaId;
    const khoa = await Khoa.findById(userLike.khoaId).select('name');
    scopeLabel = khoa?.name ? `khoa «${khoa.name}»` : 'khoa đã chọn';
  } else if (role === ROLES.DEPARTMENT_CHAIR) {
    if (!userLike.boMonId) {
      throw new ValidationError('Trưởng bộ môn cần chọn bộ môn');
    }
    filter.boMonId = userLike.boMonId;
    const boMon = await BoMon.findById(userLike.boMonId).select('name');
    scopeLabel = boMon?.name ? `bộ môn «${boMon.name}»` : 'bộ môn đã chọn';
  } else if (role === ROLES.DEPARTMENT_HEAD || role === ROLES.CENTER_DIRECTOR) {
    const dept = String(userLike.department || '').trim();
    if (!dept) {
      throw new ValidationError('Vui lòng nhập Đơn vị / Phòng ban');
    }
    filter.department = { $regex: new RegExp(`^${escapeRegex(dept)}$`, 'i') };
    scopeLabel = `đơn vị «${dept}»`;
  } else {
    return;
  }

  const existing = await User.findOne(filter).select('fullName email');
  if (!existing) return;

  const roleLabel = ROLE_LABELS[role] || role;
  throw new ValidationError(
    `Đã có ${roleLabel} đang hoạt động tại ${scopeLabel}: ${existing.fullName} (${existing.email}). Hãy khóa tài khoản đó trước khi thêm hoặc kích hoạt tài khoản mới.`,
  );
};
