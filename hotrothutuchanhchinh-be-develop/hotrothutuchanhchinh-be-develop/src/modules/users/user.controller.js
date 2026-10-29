import * as userService from './user.service.js';
import * as studentProfileService from './studentProfile.service.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';
import { ROLES } from '../../config/roles.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../shared/constants/httpStatus.js';
import { parsePagination } from '../../shared/utils/pagination.js';

export const getAll = async (req, res) => {
  const pagination = parsePagination(req.query);
  const result = await userService.getAll(req.query, pagination);
  return successResponse(res, result.data, 'Success', HTTP_STATUS.OK, result.meta);
};

export const getById = async (req, res) => {
  const isSelf = String(req.user?.id || '') === String(req.params.id);
  if (req.user?.role !== ROLES.ADMIN && !isSelf) {
    throw new ForbiddenError('Bạn không có quyền xem hồ sơ tài khoản này');
  }
  const user = await userService.getById(req.params.id);
  return successResponse(res, user);
};

export const getMe = async (req, res) => {
  const user = await userService.getMe(req.user.id);
  return successResponse(res, user);
};

export const getMyStudentProfile = async (req, res) => {
  const profile = await studentProfileService.getMyStudentProfile(req.user.id);
  return successResponse(res, profile);
};

export const updateMyStudentProfile = async (req, res) => {
  const profile = await studentProfileService.updateMyStudentProfile(req.user.id, req.body);
  return successResponse(res, profile, 'Cập nhật thông tin cá nhân thành công');
};

export const create = async (req, res) => {
  const user = await userService.create(req.body);
  return successResponse(res, user, 'User created', HTTP_STATUS.CREATED);
};

export const update = async (req, res) => {
  const user = await userService.update(req.params.id, req.body);
  return successResponse(res, user, 'User updated');
};

export const updateStatus = async (req, res) => {
  const user = await userService.updateStatus(req.params.id, req.body.isActive);
  return successResponse(res, user, 'Status updated');
};

export const remove = async (req, res) => {
  const user = await userService.remove(req.params.id);
  return successResponse(res, user, 'User soft-deleted successfully');
};

export const getAdvisorDuty = async (req, res) => {
  const data = await userService.getAdvisorDuty(req.params.id);
  return successResponse(res, data);
};

export const assignAdvisorDuty = async (req, res) => {
  const user = await userService.assignAdvisorDuty(req.params.id, req.body);
  return successResponse(res, user, 'Đã gán nhiệm vụ cố vấn học tập');
};

export const updateMe = async (req, res) => {
  const user = await userService.updateMe(req.user.id, req.body);
  return successResponse(res, user, 'Cập nhật thông tin cá nhân thành công');
};

export const changeMyPassword = async (req, res) => {
  const user = await userService.changeMyPassword(req.user.id, req.body);
  return successResponse(res, user, 'Đổi mật khẩu thành công', HTTP_STATUS.OK);
};

export const uploadMyAvatar = async (req, res) => {
  const user = await userService.uploadMyAvatar(req.user.id, req.file);
  return successResponse(res, user, 'Cập nhật ảnh đại diện thành công');
};

export const deleteMyAvatar = async (req, res) => {
  const user = await userService.deleteMyAvatar(req.user.id);
  return successResponse(res, user, 'Xóa ảnh đại diện thành công');
};

export const uploadMySignatureImage = async (req, res) => {
  const user = await userService.uploadMySignatureImage(req.user.id, req.file);
  return successResponse(res, user, 'Cập nhật ảnh chữ ký thành công');
};

export const deleteMySignatureImage = async (req, res) => {
  const user = await userService.deleteMySignatureImage(req.user.id);
  return successResponse(res, user, 'Xóa ảnh chữ ký thành công');
};

export const verifyMySmartCa = async (req, res) => {
  const user = await userService.verifyAndLinkMySmartCa(req.user.id, req.body);
  return successResponse(res, user, 'Đã tích hợp VNPT SmartCA vào tài khoản');
};

export const unlinkMySmartCa = async (req, res) => {
  const user = await userService.unlinkMySmartCa(req.user.id);
  return successResponse(res, user, 'Đã gỡ liên kết SmartCA');
};

export const linkMyGoogle = async (req, res) => {
  const user = await userService.linkGoogleAccount(req.user.id, req.body);
  return successResponse(res, user, 'Liên kết Google thành công');
};

export const unlinkMyGoogle = async (req, res) => {
  const user = await userService.unlinkGoogleAccount(req.user.id);
  return successResponse(res, user, 'Hủy liên kết Google thành công');
};

