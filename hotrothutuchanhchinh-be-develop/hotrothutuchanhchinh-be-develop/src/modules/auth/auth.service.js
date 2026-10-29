import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import config from '../../config/index.js';
import * as authRepository from './auth.repository.js';
import PasswordReset from './passwordReset.model.js';
import User from '../users/user.model.js';
import { comparePassword, hashPassword } from '../../shared/utils/hashPassword.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../shared/utils/generateToken.js';
import {
  UnauthorizedError,
  ValidationError,
  NotFoundError,
} from '../../shared/errors/AppError.js';
import { ROLE_PERMISSIONS } from '../../config/roles.js';
import { assertCtutEmail, assertStandardEmail } from '../../shared/validators/ctutEmail.js';
import { ROLES } from '../../config/roles.js';
import { sendPasswordResetEmail } from '../../shared/services/emailService.js';
import { ensureStudentUserLinked } from '../users/studentProfile.service.js';
import { persistMissingOrgDisplayNames } from '../users/user.service.js';
import { getAdminPortalUrl } from '../../config/clientUrls.js';

const isValidEmailFormat = (email) =>
  typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const GENERIC_FORGOT_MESSAGE =
  'Liên kết đặt lại mật khẩu đã được gửi đến email của bạn.';

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const googleClient = new OAuth2Client();

const formatUser = (user) => ({
  _id: user._id,
  email: user.email,
  fullName: user.fullName,
  role: user.role,
  permissions: ROLE_PERMISSIONS[user.role] || [],
  studentId: user.studentId,
  phone: user.phone,
  department: user.department,
  faculty: user.faculty,
  avatar: user.avatar || '',
  dateOfBirth: user.dateOfBirth,
  gender: user.gender,
  address: user.address,
  lastLoginAt: user.lastLoginAt,
  googleLinked: Boolean(user.googleLinkedAt),
  googleEmail: user.googleEmail || '',
  googlePicture: user.googlePicture || '',
  googleLinkedAt: user.googleLinkedAt,
  signatureImageUrl: user.signatureImageUrl || '',
  mustChangePassword: Boolean(user.mustChangePassword),
  smartCaUserId: user.smartCaUserId || '',
  smartCaVerifiedAt: user.smartCaVerifiedAt || null,
  smartCaCertSubject: user.smartCaCertSubject || '',
});

const AUTH_INPUT_MAX_LENGTH = 80;
const ISSUED_DEFAULT_PASSWORDS = ['Pmtthc@123', 'Student@123'];

/** Tài khoản vẫn dùng mật khẩu cấp sẵn thì bắt đổi ở lần đăng nhập. */
const flagIssuedDefaultPassword = async (user) => {
  if (!user?.password || user.mustChangePassword) return user;
  for (const plain of ISSUED_DEFAULT_PASSWORDS) {
    if (await comparePassword(plain, user.password)) {
      user.mustChangePassword = true;
      await user.save();
      return user;
    }
  }
  return user;
};

const assertAuthInputLength = (value, label) => {
  if (typeof value === 'string' && value.length > AUTH_INPUT_MAX_LENGTH) {
    throw new ValidationError(`${label} tối đa ${AUTH_INPUT_MAX_LENGTH} ký tự`);
  }
};

const buildAuthResponse = async (user, rememberMe = false, extra = {}) => {
  const linkedUser = await persistMissingOrgDisplayNames(await ensureStudentUserLinked(user));
  const payload = { id: String(linkedUser._id), email: linkedUser.email, role: linkedUser.role };
  const accessToken = generateAccessToken(payload);
  const refreshExpiresIn = rememberMe
    ? config.jwt.refreshExpiresIn
    : config.jwt.sessionRefreshExpiresIn;
  const refreshToken = generateRefreshToken(payload, refreshExpiresIn);

  await authRepository.updateRefreshToken(linkedUser._id, hashToken(refreshToken), rememberMe);
  await authRepository.updateLastLogin(linkedUser._id);

  return {
    user: formatUser(linkedUser),
    accessToken,
    refreshToken,
    rememberMe,
    ...extra,
  };
};

const verifyGoogleIdentity = async (idToken) => {
  if (!config.google.clientId) {
    throw new ValidationError('Đăng nhập Google chưa được cấu hình trên hệ thống');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new ValidationError('Thiếu thông tin xác thực Google');
  }

  let ticket;
  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: config.google.clientId,
    });
  } catch (error) {
    console.error('[Auth][GoogleVerify]', error?.message || error);
    throw new UnauthorizedError(
      'Token Google không hợp lệ. Kiểm tra GOOGLE_CLIENT_ID trên server trùng với VITE_GOOGLE_CLIENT_ID.',
    );
  }
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload?.email) {
    throw new ValidationError('Không đọc được thông tin tài khoản Google');
  }
  if (!payload.email_verified) {
    throw new ValidationError('Email Google chưa được xác minh');
  }

  const email = payload.email.toLowerCase().trim();
  assertStandardEmail(email);

  return {
    sub: payload.sub,
    email,
    picture: payload.picture || '',
  };
};

export const login = async ({ email, password, rememberMe = false }) => {
  assertAuthInputLength(email, 'Tài khoản');
  assertAuthInputLength(password, 'Mật khẩu');
  assertStandardEmail(email);

  const user = await authRepository.findByEmail(email);
  if (!user) {
    throw new UnauthorizedError('Sai tài khoản');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Tài khoản đã bị khóa');
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Sai mật khẩu');
  }

  const flagged = await flagIssuedDefaultPassword(user);
  return buildAuthResponse(flagged, rememberMe);
};

const assertGoogleEmailForRole = (email, role) => {
  if (role === ROLES.STUDENT) {
    assertCtutEmail(email);
    return;
  }
  assertStandardEmail(email);
};

export const googleLogin = async ({ idToken, rememberMe = false }) => {
  const googleIdentity = await verifyGoogleIdentity(idToken);
  const user = await authRepository.findByEmailWithGoogle(googleIdentity.email);
  let linkedGoogleNow = false;

  const logGoogleLoginDebug = (reason, extra = {}) => {
    console.log('[Auth][GoogleLogin]', {
      reason,
      googleEmail: googleIdentity.email,
      matchedUserEmail: user?.email || null,
      matchedUserRole: user?.role || null,
      ...extra,
    });
  };

  if (!user) {
    logGoogleLoginDebug('user_not_found');
    if (googleIdentity.email.endsWith('@student.ctuet.edu.vn')) {
      throw new UnauthorizedError('Email sinh viên này chưa được đăng ký trong hệ thống');
    }
    throw new UnauthorizedError('Email Google này chưa được đăng ký trong hệ thống');
  }
  if (!user.isActive) {
    logGoogleLoginDebug('user_inactive');
    throw new UnauthorizedError('Tài khoản đã bị khóa');
  }

  assertGoogleEmailForRole(googleIdentity.email, user.role);

  if (googleIdentity.email !== user.email) {
    logGoogleLoginDebug('email_mismatch');
    throw new UnauthorizedError('Email Google phải trùng với email tài khoản trong hệ thống');
  }

  const linkedToAnotherUser = await authRepository.findByGoogleSub(googleIdentity.sub);
  if (
    linkedToAnotherUser &&
    linkedToAnotherUser._id.toString() !== user._id.toString()
  ) {
    // Liên kết cũ còn sót sau khi đổi email tài khoản nội bộ.
    if (linkedToAnotherUser.email !== googleIdentity.email) {
      await authRepository.unlinkGoogleLink(linkedToAnotherUser._id);
      logGoogleLoginDebug('cleared_stale_google_link', {
        linkedUserEmail: linkedToAnotherUser.email || null,
      });
    } else {
      logGoogleLoginDebug('google_sub_linked_elsewhere', {
        linkedUserEmail: linkedToAnotherUser.email || null,
      });
      throw new UnauthorizedError('Tài khoản Google này đã được liên kết với tài khoản khác');
    }
  }

  // Tự liên kết Google ngay ở bước đăng nhập đầu tiên nếu email trùng tài khoản hệ thống.
  if (!user.googleSub || !user.googleLinkedAt) {
    user.googleSub = googleIdentity.sub;
    user.googleEmail = googleIdentity.email;
    user.googlePicture = googleIdentity.picture;
    user.googleLinkedAt = new Date();
    await user.save();
    logGoogleLoginDebug('linked_now');
    linkedGoogleNow = true;
  } else if (user.googleSub !== googleIdentity.sub) {
    logGoogleLoginDebug('google_sub_mismatch_existing_link');
    throw new UnauthorizedError('Tài khoản Google không khớp với tài khoản đã liên kết');
  }

  logGoogleLoginDebug('login_success', { linkedGoogleNow });
  const flagged = await flagIssuedDefaultPassword(user);
  return buildAuthResponse(flagged, rememberMe, { linkedGoogleNow });
};

const refreshTokenMatches = (stored, token) => {
  if (!stored || !token) return false;
  if (stored === hashToken(token)) return true;
  return stored === token;
};

export const refreshToken = async (token) => {
  const decoded = verifyRefreshToken(token);
  const user = await authRepository.findByIdWithSession(decoded.id);

  if (!user || !refreshTokenMatches(user.refreshToken, token)) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const payload = { id: String(user._id), email: user.email, role: user.role };
  const refreshExpiresIn = user.rememberSession
    ? config.jwt.refreshExpiresIn
    : config.jwt.sessionRefreshExpiresIn;
  const newRefreshToken = generateRefreshToken(payload, refreshExpiresIn);
  await authRepository.updateRefreshToken(user._id, hashToken(newRefreshToken), user.rememberSession);

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: newRefreshToken,
  };
};

export const logout = async (userId) => {
  await authRepository.updateRefreshToken(userId, null, false);
};

export const getMe = async (userId) => {
  const user = await authRepository.findById(userId);
  if (!user) throw new UnauthorizedError('User not found');
  const linkedUser = await persistMissingOrgDisplayNames(await ensureStudentUserLinked(user));
  return formatUser(linkedUser);
};

export const forgotPassword = async ({ accountEmail, recipientEmail }) => {
  if (!isValidEmailFormat(accountEmail)) {
    throw new ValidationError('Email tài khoản không đúng định dạng');
  }
  if (!isValidEmailFormat(recipientEmail)) {
    throw new ValidationError('Email nhận liên kết không đúng định dạng');
  }

  const normalizedAccountEmail = accountEmail.toLowerCase().trim();
  const normalizedRecipientEmail = recipientEmail.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedAccountEmail, isActive: true });

  await PasswordReset.updateMany(
    { accountEmail: normalizedAccountEmail, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await PasswordReset.create({
    userId: user?._id ?? null,
    accountEmail: normalizedAccountEmail,
    recipientEmail: normalizedRecipientEmail,
    tokenHash: hashToken(rawToken),
    expiresAt,
  });

  const resetUrl = `${getAdminPortalUrl()}/auth/reset-password?token=${rawToken}`;
  try {
    await sendPasswordResetEmail({
      to: normalizedRecipientEmail,
      resetUrl,
      fullName: user?.fullName ?? 'Bạn',
    });
  } catch (err) {
    throw new ValidationError(err.message || 'Không gửi được email qua Gmail');
  }

  return { message: GENERIC_FORGOT_MESSAGE };
};

export const verifyResetToken = async (token) => {
  if (!token) throw new ValidationError('Token không hợp lệ');

  const record = await PasswordReset.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    throw new NotFoundError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  if (!record.userId) {
    throw new NotFoundError('Không tìm thấy tài khoản liên kết với email đăng nhập');
  }

  return { valid: true, accountEmail: record.accountEmail };
};

export const resetPassword = async ({ token, password }) => {
  if (!token) throw new ValidationError('Token không hợp lệ');
  if (!password || password.length < 6) {
    throw new ValidationError('Mật khẩu phải có ít nhất 6 ký tự');
  }

  const record = await PasswordReset.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  if (!record) {
    throw new NotFoundError('Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn');
  }

  if (!record.userId) {
    throw new NotFoundError('Không tìm thấy tài khoản liên kết với yêu cầu này');
  }

  if (ISSUED_DEFAULT_PASSWORDS.includes(password)) {
    throw new ValidationError('Mật khẩu mới không được trùng mật khẩu mặc định của hệ thống');
  }

  const hashedPassword = await hashPassword(password);
  await User.findByIdAndUpdate(record.userId, {
    password: hashedPassword,
    mustChangePassword: false,
    refreshToken: null,
    rememberSession: false,
  });

  record.usedAt = new Date();
  await record.save();

  return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.' };
};
