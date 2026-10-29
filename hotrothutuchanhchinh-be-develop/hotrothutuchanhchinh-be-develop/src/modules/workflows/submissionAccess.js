import User from '../users/user.model.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { userCanViewSubmission } from './workflowScope.js';

const VIEWER_SELECT =
  'email fullName role khoaId boMonId lopId giangVienId studentId sinhVienId isActive department faculty';

export const loadSubmissionViewer = async (userLike) => {
  const id = userLike?.id || userLike?._id;
  if (!id) return null;
  const user = await User.findById(id).select(VIEWER_SELECT);
  if (!user || user.isActive === false) return null;
  return user;
};

export const assertCanViewSubmission = async (file, userLike) => {
  const viewer = await loadSubmissionViewer(userLike);
  if (!viewer || !(await userCanViewSubmission(viewer, file))) {
    throw new ForbiddenError('Bạn không có quyền xem hồ sơ này');
  }
  return viewer;
};
