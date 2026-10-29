import * as authService from './auth.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../shared/constants/httpStatus.js';

export const login = async (req, res) => {
  const result = await authService.login(req.body);
  return successResponse(res, result, 'Login successful', HTTP_STATUS.OK);
};

export const googleLogin = async (req, res) => {
  const result = await authService.googleLogin(req.body);
  return successResponse(res, result, 'Google login successful', HTTP_STATUS.OK);
};

export const refresh = async (req, res) => {
  const result = await authService.refreshToken(req.body.refreshToken);
  return successResponse(res, result, 'Token refreshed');
};

export const logout = async (req, res) => {
  await authService.logout(req.user.id);
  return successResponse(res, null, 'Logout successful');
};

export const getMe = async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return successResponse(res, user);
};

export const forgotPassword = async (req, res) => {
  const { accountEmail, recipientEmail, email } = req.body;
  const result = await authService.forgotPassword({
    accountEmail,
    recipientEmail: recipientEmail ?? email,
  });
  return successResponse(res, result, result.message);
};

export const verifyResetToken = async (req, res) => {
  const result = await authService.verifyResetToken(req.query.token);
  return successResponse(res, result);
};

export const resetPassword = async (req, res) => {
  const result = await authService.resetPassword(req.body);
  return successResponse(res, result, result.message);
};
