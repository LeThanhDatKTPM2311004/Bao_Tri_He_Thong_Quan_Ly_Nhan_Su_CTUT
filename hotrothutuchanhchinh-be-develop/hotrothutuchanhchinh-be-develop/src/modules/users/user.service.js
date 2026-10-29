import { OAuth2Client } from 'google-auth-library';
import * as userRepository from './user.repository.js';
import { comparePassword, hashPassword } from '../../shared/utils/hashPassword.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import { buildPaginationMeta } from '../../shared/utils/pagination.js';
import { assertCtutEmail, assertStandardEmail } from '../../shared/validators/ctutEmail.js';
import { assertValidPhoneIfProvided } from '../../shared/validators/phoneText.js';
import { ROLES } from '../../config/roles.js';
import config from '../../config/index.js';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js';
import GiangVien from '../organization/models/giangVien.model.js';
import SinhVien from '../organization/models/sinhVien.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import {
  ensureGiangVienForStaffUser,
  ensureSinhVienForStudentUser,
  syncSinhVienFromUser,
  syncSinhVienActiveFromUser,
  assignAdvisorDutyToUser,
  getAdvisorDutyForUser,
} from '../organization/orgUserSync.service.js';
import { assertExclusiveLeadershipRole } from './leadershipUniqueness.js';
import Lop from '../organization/models/lop.model.js';
const googleClient = new OAuth2Client();
const ISSUED_DEFAULT_PASSWORDS = ['Pmtthc@123', 'Student@123'];

/** Sinh viên: @student.ctuet.edu.vn — các vai trò khác: email định dạng bình thường */
const assertEmailByRole = (email, role) => {
  if (role === ROLES.STUDENT) {
    assertCtutEmail(email);
    return;
  }
  assertStandardEmail(email);
};

/** Gỡ org fields theo cấp vai trò: trường / khoa / phòng / trung tâm */
const sanitizeOrgByRole = (data) => {
  if (data.role === ROLES.PRINCIPAL || data.role === ROLES.VICE_PRINCIPAL) {
    return {
      ...data,
      khoaId: null,
      boMonId: null,
      lopId: null,
      faculty: '',
      department: '',
    };
  }
  if (
    data.role === ROLES.FACULTY_MANAGER ||
    data.role === ROLES.DEPUTY_FACULTY_MANAGER ||
    data.role === ROLES.KHOA_ASSISTANT
  ) {
    return {
      ...data,
      boMonId: null,
      lopId: null,
      department: '',
    };
  }
  if (
    data.role === ROLES.DEPARTMENT_HEAD ||
    data.role === ROLES.DEPUTY_DEPARTMENT_HEAD ||
    data.role === ROLES.CENTER_DIRECTOR ||
    data.role === ROLES.DEPUTY_CENTER_DIRECTOR ||
    data.role === ROLES.PHONG_ASSISTANT ||
    data.role === ROLES.TRUNG_TAM_ASSISTANT ||
    data.role === ROLES.OFFICE_STAFF
  ) {
    return {
      ...data,
      khoaId: null,
      boMonId: null,
      lopId: null,
      faculty: '',
      department: String(data.department || '').trim(),
    };
  }
  return data;
};

const FACULTY_LEVEL_ROLES = new Set([
  ROLES.FACULTY_MANAGER,
  ROLES.DEPUTY_FACULTY_MANAGER,
  ROLES.KHOA_ASSISTANT,
]);

const DEPARTMENT_LEVEL_ROLES = new Set([
  ROLES.DEPARTMENT_CHAIR,
  ROLES.DEPUTY_DEPARTMENT_CHAIR,
  ROLES.FACULTY_ASSISTANT,
]);

const OFFICE_LEVEL_ROLES = new Set([
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.PHONG_ASSISTANT,
  ROLES.TRUNG_TAM_ASSISTANT,
  ROLES.OFFICE_STAFF,
]);

const loadOrgNames = async (khoaId, boMonId) => {
  const [khoa, boMon] = await Promise.all([
    khoaId ? Khoa.findById(khoaId).select('name') : null,
    boMonId ? BoMon.findById(boMonId).select('name khoaId') : null,
  ]);
  return {
    faculty: khoa?.name || '',
    department: boMon?.name || '',
    boMonKhoaId: boMon?.khoaId || null,
  };
};

/** Ghi tên khoa / bộ môn lên User.faculty và User.department để trang tài khoản hiển thị. */
const applyOrgDisplayNames = async (payload) => {
  if (!payload) return payload;
  const role = payload.role;
  if (
    !role ||
    role === ROLES.ADMIN ||
    role === ROLES.PRINCIPAL ||
    role === ROLES.VICE_PRINCIPAL ||
    OFFICE_LEVEL_ROLES.has(role)
  ) {
    return payload;
  }

  const names = await loadOrgNames(payload.khoaId, payload.boMonId);
  if (payload.khoaId) payload.faculty = names.faculty;
  if (FACULTY_LEVEL_ROLES.has(role)) {
    payload.department = '';
  } else if (payload.boMonId) {
    payload.department = names.department;
  }
  return payload;
};

/** Khoa / bộ môn bắt buộc theo cấp cán bộ, và bộ môn phải thuộc khoa đã chọn. */
const assertStaffOrgSelection = async (payload) => {
  const role = payload?.role;
  if (!role || role === ROLES.ADMIN || role === ROLES.STUDENT) return;

  if (FACULTY_LEVEL_ROLES.has(role) && !payload.khoaId) {
    throw new ValidationError('Vui lòng chọn khoa');
  }
  if (DEPARTMENT_LEVEL_ROLES.has(role)) {
    if (!payload.khoaId) throw new ValidationError('Vui lòng chọn khoa');
    if (!payload.boMonId) throw new ValidationError('Vui lòng chọn bộ môn');
  }
  if (role === ROLES.LECTURER && (!payload.khoaId || !payload.boMonId)) {
    throw new ValidationError('Giảng viên cần chọn khoa và bộ môn');
  }
  if (!payload.khoaId && !payload.boMonId) return;

  const names = await loadOrgNames(payload.khoaId, payload.boMonId);
  if (payload.khoaId && !names.faculty) {
    throw new ValidationError('Khoa không tồn tại');
  }
  if (payload.boMonId && !names.department) {
    throw new ValidationError('Bộ môn không tồn tại');
  }
  if (payload.khoaId && payload.boMonId && String(names.boMonKhoaId) !== String(payload.khoaId)) {
    throw new ValidationError('Bộ môn không thuộc khoa đã chọn');
  }
};

/** Tài khoản cũ có khoaId nhưng thiếu tên hiển thị — điền lại khi đăng nhập. */
export const persistMissingOrgDisplayNames = async (userDoc) => {
  if (!userDoc?._id || !userDoc.role || userDoc.role === ROLES.ADMIN) return userDoc;
  if (
    userDoc.role === ROLES.PRINCIPAL ||
    userDoc.role === ROLES.VICE_PRINCIPAL ||
    OFFICE_LEVEL_ROLES.has(userDoc.role)
  ) {
    return userDoc;
  }

  const names = await loadOrgNames(userDoc.khoaId, userDoc.boMonId);
  const patch = {};
  if (userDoc.khoaId && !String(userDoc.faculty || '').trim() && names.faculty) {
    patch.faculty = names.faculty;
  }
  if (
    !FACULTY_LEVEL_ROLES.has(userDoc.role) &&
    userDoc.boMonId &&
    !String(userDoc.department || '').trim() &&
    names.department
  ) {
    patch.department = names.department;
  }
  if (Object.keys(patch).length === 0) return userDoc;
  return (await userRepository.update(userDoc._id, patch)) || userDoc;
};

/**
 * Liên kết User với SinhVien/GiangVien theo email (hoặc mã SV).
 * Đồng bộ khoa/bộ môn/lớp từ bản ghi tổ chức khi User chưa có.
 */
const linkOrgEntitiesToUser = async (userDoc) => {
  if (!userDoc?._id || !userDoc.email) return userDoc;
  if (userDoc.role === ROLES.ADMIN) return userDoc;

  const email = String(userDoc.email).trim().toLowerCase();
  let changed = false;
  const patch = {};

  if (userDoc.role === ROLES.STUDENT) {
    let sv = null;
    if (userDoc.sinhVienId) {
      sv = await SinhVien.findById(userDoc.sinhVienId);
    }
    if (!sv && userDoc.studentId) {
      sv = await SinhVien.findOne({ maSV: String(userDoc.studentId).trim() });
    }
    if (!sv) {
      sv = await SinhVien.findOne({ email, isActive: { $ne: false } });
    }
    if (sv) {
      patch.sinhVienId = sv._id;
      patch.studentId = sv.maSV;
      patch.giangVienId = null;
      if (sv.khoaId) patch.khoaId = sv.khoaId;
      if (sv.boMonId) patch.boMonId = sv.boMonId;
      if (sv.lopId) patch.lopId = sv.lopId;
      const names = await loadOrgNames(sv.khoaId, sv.boMonId);
      if (names.faculty) patch.faculty = names.faculty;
      if (names.department) patch.department = names.department;
      if (!sv.userId || String(sv.userId) !== String(userDoc._id)) {
        await SinhVien.findByIdAndUpdate(sv._id, { userId: userDoc._id });
      }
      changed = true;
    }
  } else {
    let gv = null;
    if (userDoc.giangVienId) {
      gv = await GiangVien.findById(userDoc.giangVienId);
    }
    if (!gv) {
      gv = await GiangVien.findOne({ email, isActive: { $ne: false } });
    }
    if (gv) {
      patch.giangVienId = gv._id;
      patch.sinhVienId = null;
      patch.studentId = null;
      patch.lopId = null;
      if (gv.khoaId && !userDoc.khoaId) patch.khoaId = gv.khoaId;
      if (gv.boMonId && !userDoc.boMonId) patch.boMonId = gv.boMonId;
      const names = await loadOrgNames(gv.khoaId || patch.khoaId, gv.boMonId || patch.boMonId);
      if (!userDoc.faculty && names.faculty) patch.faculty = names.faculty;
      if (!userDoc.department && names.department) patch.department = names.department;
      if (!gv.userId || String(gv.userId) !== String(userDoc._id)) {
        await GiangVien.findByIdAndUpdate(gv._id, { userId: userDoc._id });
      }
      changed = true;
    }
  }

  if (!changed || Object.keys(patch).length === 0) return userDoc;
  return userRepository.update(userDoc._id, patch);
};

const formatAccountUser = (user) => {
  const data = typeof user?.toObject === 'function' ? user.toObject() : { ...user };
  delete data.password;
  delete data.refreshToken;
  delete data.googleSub;
  delete data.avatarPublicId;
  delete data.signatureImagePublicId;
  return {
    ...data,
    avatar: data.avatar || '',
    signatureImageUrl: data.signatureImageUrl || '',
    mustChangePassword: Boolean(data.mustChangePassword),
    smartCaUserId: data.smartCaUserId || '',
    smartCaVerifiedAt: data.smartCaVerifiedAt || null,
    smartCaCertSubject: data.smartCaCertSubject || '',
    googleLinked: Boolean(data.googleLinkedAt),
    googleEmail: data.googleEmail || '',
    googlePicture: data.googlePicture || '',
    googleLinkedAt: data.googleLinkedAt || null,
  };
};

export const getAll = async (query, pagination) => {
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.search) {
    filter.$or = [
      { fullName: { $regex: query.search, $options: 'i' } },
      { email: { $regex: query.search, $options: 'i' } },
      { department: { $regex: query.search, $options: 'i' } },
      { faculty: { $regex: query.search, $options: 'i' } },
      { studentId: { $regex: query.search, $options: 'i' } },
    ];
  }
  if (query.isActive !== undefined && query.isActive !== '') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  }

  const [data, total] = await Promise.all([
    userRepository.findAll(filter, pagination),
    userRepository.count(filter),
  ]);

  return { data, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
};

export const getById = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
};

export const getMe = async (userId) => {
  const user = await userRepository.findById(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');
  return formatAccountUser(user);
};

export const create = async (data) => {
  if (!data.role) {
    throw new ValidationError('Vui lòng chọn vai trò');
  }
  if (data.role === ROLES.ACADEMIC_ADVISOR) {
    throw new ValidationError(
      'Cố vấn học tập không phải vai trò hệ thống — hãy gán nhiệm vụ cố vấn từ Thao tác trên trang Người dùng',
    );
  }
  if (data.role === ROLES.STUDENT) {
    if (!data.lopId) {
      throw new ValidationError(
        'Vui lòng chọn lớp để tạo hồ sơ sinh viên đồng bộ (Lớp & Sinh viên)',
      );
    }
    const lop = await Lop.findById(data.lopId).select('khoaId boMonId');
    if (!lop) throw new ValidationError('Lớp không tồn tại');
    if (!data.khoaId) data.khoaId = lop.khoaId;
    if (!data.boMonId) data.boMonId = lop.boMonId;
  }
  assertEmailByRole(data.email, data.role);
  const phone = assertValidPhoneIfProvided(data.phone);
  const hashedPassword = await hashPassword(data.password);
  const payload = sanitizeOrgByRole({
    ...data,
    phone,
    password: hashedPassword,
    mustChangePassword: ISSUED_DEFAULT_PASSWORDS.includes(data.password),
  });
  await assertStaffOrgSelection(payload);
  await applyOrgDisplayNames(payload);
  delete payload.lopCoVanIds;
  delete payload.maGV;
  // Mã SV do server sinh khi tạo hồ sơ — bỏ preview từ client
  if (payload.role === ROLES.STUDENT) {
    delete payload.studentId;
  } else {
    delete payload.studentId;
    delete payload.sinhVienId;
    if (payload.role === ROLES.LECTURER) {
      delete payload.lopId;
    }
  }
  if (payload.studentId === '' || payload.studentId == null) {
    delete payload.studentId;
  }
  await assertExclusiveLeadershipRole({
    role: payload.role,
    khoaId: payload.khoaId,
    boMonId: payload.boMonId,
    department: payload.department,
    isActive: payload.isActive !== false,
  });
  const created = await userRepository.create(payload);
  let linked = await linkOrgEntitiesToUser(created);

  if (linked.role === ROLES.STUDENT) {
    linked = await ensureSinhVienForStudentUser(linked);
  }

  if (linked.role === ROLES.LECTURER) {
    linked = await ensureGiangVienForStaffUser(linked, {
      khoaId: linked.khoaId || data.khoaId,
      boMonId: linked.boMonId || data.boMonId,
    });
  }

  return linked;
};

export const update = async (id, data) => {
  const existing = await userRepository.findById(id);
  if (!existing) throw new NotFoundError('User not found');
  if (data.password) {
    data.mustChangePassword = ISSUED_DEFAULT_PASSWORDS.includes(data.password);
    data.password = await hashPassword(data.password);
  }
  if (data.phone != null) {
    data.phone = assertValidPhoneIfProvided(data.phone);
  }
  if (data.email != null) {
    assertEmailByRole(data.email, data.role || existing.role);
  }
  const role = data.role || existing.role;
  if (role === ROLES.ACADEMIC_ADVISOR) {
    throw new ValidationError(
      'Cố vấn học tập không phải vai trò hệ thống — hãy gán nhiệm vụ cố vấn từ Thao tác trên trang Người dùng',
    );
  }
  if (role === ROLES.STUDENT) {
    const nextLopId = data.lopId !== undefined ? data.lopId : existing.lopId;
    if (!nextLopId && !existing.sinhVienId) {
      throw new ValidationError(
        'Vui lòng chọn lớp để đồng bộ hồ sơ sinh viên (Lớp & Sinh viên)',
      );
    }
    if (data.lopId) {
      const lop = await Lop.findById(data.lopId).select('khoaId boMonId');
      if (!lop) throw new ValidationError('Lớp không tồn tại');
      if (data.khoaId === undefined) data.khoaId = lop.khoaId;
      if (data.boMonId === undefined) data.boMonId = lop.boMonId;
    }
  }
  const payload = sanitizeOrgByRole({ ...data, role });
  if (payload.khoaId === undefined) payload.khoaId = existing.khoaId;
  if (payload.boMonId === undefined && !FACULTY_LEVEL_ROLES.has(role)) {
    payload.boMonId = existing.boMonId;
  }
  await assertStaffOrgSelection(payload);
  await applyOrgDisplayNames(payload);
  delete payload.lopCoVanIds;
  delete payload.maGV;
  // Không cho client đổi mã SV — đồng bộ từ hồ sơ SinhVien
  delete payload.studentId;
  await assertExclusiveLeadershipRole(
    {
      role,
      khoaId: payload.khoaId !== undefined ? payload.khoaId : existing.khoaId,
      boMonId: payload.boMonId !== undefined ? payload.boMonId : existing.boMonId,
      department: payload.department !== undefined ? payload.department : existing.department,
      isActive: payload.isActive !== undefined ? payload.isActive : existing.isActive,
    },
    { excludeUserId: id },
  );
  const user = await userRepository.update(id, payload);
  if (!user) throw new NotFoundError('User not found');
  let linked = await linkOrgEntitiesToUser(user);

  if (linked.role === ROLES.STUDENT) {
    linked = await ensureSinhVienForStudentUser(linked);
  }

  if (linked.role === ROLES.LECTURER) {
    linked = await ensureGiangVienForStaffUser(linked, {
      khoaId: data.khoaId !== undefined ? data.khoaId : linked.khoaId,
      boMonId: data.boMonId !== undefined ? data.boMonId : linked.boMonId,
    });
  }

  return linked;
};

export const getAdvisorDuty = async (id) => {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return getAdvisorDutyForUser(user);
};

export const assignAdvisorDuty = async (id, data) => {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError('User not found');
  return assignAdvisorDutyToUser(user, {
    khoaId: data.khoaId,
    boMonId: data.boMonId,
    lopCoVanIds: data.lopCoVanIds,
  });
};

export const updateStatus = async (id, isActive) => {
  const existing = await userRepository.findById(id);
  if (!existing) throw new NotFoundError('User not found');
  if (existing.role === ROLES.ADMIN) {
    throw new ForbiddenError('Không thể thay đổi trạng thái hoạt động của tài khoản quản trị viên');
  }

  if (isActive) {
    await assertExclusiveLeadershipRole(existing, { excludeUserId: id });
  }

  const user = await userRepository.update(id, { isActive });
  if (!user) throw new NotFoundError('User not found');

  if (user.role === ROLES.STUDENT) {
    await syncSinhVienActiveFromUser(user, isActive);
  }

  return user;
};

export const remove = async (id) => {
  const user = await userRepository.remove(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
};

const sanitizeProfilePayload = (data) => {
  const allowed = ['fullName', 'phone', 'avatar', 'dateOfBirth', 'gender', 'address'];
  return allowed.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      acc[key] = data[key];
    }
    return acc;
  }, {});
};

export const updateMe = async (userId, data) => {
  const payload = sanitizeProfilePayload(data);
  if (Object.keys(payload).length === 0) {
    throw new ValidationError('Không có thông tin hợp lệ để cập nhật');
  }

  if ('fullName' in payload && !String(payload.fullName || '').trim()) {
    throw new ValidationError('Họ và tên không được để trống');
  }

  if ('phone' in payload) {
    payload.phone = assertValidPhoneIfProvided(payload.phone);
  }

  const user = await userRepository.updateMe(userId, payload);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  if (user.role === ROLES.STUDENT) {
    await syncSinhVienFromUser(user);
  }

  return formatAccountUser(user);
};

export const changeMyPassword = async (userId, data) => {
  const { currentPassword, newPassword, confirmPassword } = data;

  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new ValidationError('Vui lòng nhập đầy đủ thông tin đổi mật khẩu');
  }

  if (newPassword.length < 8) {
    throw new ValidationError('Mật khẩu mới phải có ít nhất 8 ký tự');
  }

  if (newPassword !== confirmPassword) {
    throw new ValidationError('Xác nhận mật khẩu mới không khớp');
  }

  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  const isMatch = await comparePassword(currentPassword, user.password);
  if (!isMatch) {
    throw new ValidationError('Sai mật khẩu');
  }

  const sameAsCurrent = await comparePassword(newPassword, user.password);
  if (sameAsCurrent) {
    throw new ValidationError('Mật khẩu mới phải khác mật khẩu hiện tại');
  }

  if (ISSUED_DEFAULT_PASSWORDS.includes(newPassword)) {
    throw new ValidationError('Mật khẩu mới không được trùng mật khẩu mặc định của hệ thống');
  }

  const hashedPassword = await hashPassword(newPassword);
  const updated = await userRepository.update(userId, {
    password: hashedPassword,
    mustChangePassword: false,
  });
  return formatAccountUser(updated);
};

const uploadAvatarToCloudinary = (buffer, userId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'pm_tthc/avatars',
        public_id: `user-${userId}-${Date.now()}`,
        resource_type: 'image',
        overwrite: true,
        transformation: [
          { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });

export const uploadMyAvatar = async (userId, file) => {
  if (!isCloudinaryConfigured()) {
    throw new ValidationError('Cloudinary chưa được cấu hình trên server');
  }
  if (!file) {
    throw new ValidationError('Vui lòng chọn ảnh đại diện');
  }

  const user = await userRepository.findByIdWithAvatarMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  const result = await uploadAvatarToCloudinary(file.buffer, userId);

  if (user.avatarPublicId && user.avatarPublicId !== result.public_id) {
    await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' });
  }

  const updated = await userRepository.updateMe(userId, {
    avatar: result.secure_url,
    avatarPublicId: result.public_id,
  });
  return formatAccountUser(updated);
};

export const deleteMyAvatar = async (userId) => {
  if (!isCloudinaryConfigured()) {
    throw new ValidationError('Cloudinary chưa được cấu hình trên server');
  }

  const user = await userRepository.findByIdWithAvatarMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  if (user.avatarPublicId) {
    await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' });
  }

  const updated = await userRepository.updateMe(userId, {
    avatar: '',
    avatarPublicId: null,
  });
  return formatAccountUser(updated);
};

const uploadSignatureToCloudinary = (buffer, userId) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'pm_tthc/signatures',
        public_id: `sig-${userId}-${Date.now()}`,
        resource_type: 'image',
        overwrite: true,
        transformation: [
          { width: 600, height: 250, crop: 'fit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });

export const uploadMySignatureImage = async (userId, file) => {
  if (!isCloudinaryConfigured()) {
    throw new ValidationError('Cloudinary chưa được cấu hình trên server');
  }
  if (!file) {
    throw new ValidationError('Vui lòng chọn ảnh chữ ký');
  }

  const user = await userRepository.findByIdWithSignatureMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  const result = await uploadSignatureToCloudinary(file.buffer, userId);

  if (user.signatureImagePublicId && user.signatureImagePublicId !== result.public_id) {
    await cloudinary.uploader.destroy(user.signatureImagePublicId, { resource_type: 'image' });
  }

  const updated = await userRepository.updateMe(userId, {
    signatureImageUrl: result.secure_url,
    signatureImagePublicId: result.public_id,
  });
  return formatAccountUser(updated);
};

export const deleteMySignatureImage = async (userId) => {
  if (!isCloudinaryConfigured()) {
    throw new ValidationError('Cloudinary chưa được cấu hình trên server');
  }

  const user = await userRepository.findByIdWithSignatureMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  if (user.signatureImagePublicId) {
    await cloudinary.uploader.destroy(user.signatureImagePublicId, { resource_type: 'image' });
  }

  const updated = await userRepository.updateMe(userId, {
    signatureImageUrl: '',
    signatureImagePublicId: null,
  });
  return formatAccountUser(updated);
};

const normalizeSmartCaUserId = (value) =>
  String(value || '')
    .trim()
    .replace(/[\s.-]/g, '');

const assertStaffCanLinkSmartCa = (user) => {
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');
  if (user.role === ROLES.STUDENT) {
    throw new ForbiddenError('Chỉ tài khoản cán bộ mới được tích hợp SmartCA');
  }
};

const assertValidSmartCaUserId = (raw) => {
  const id = normalizeSmartCaUserId(raw);
  if (!id) {
    throw new ValidationError('Vui lòng nhập CCCD hoặc MST thuê bao VNPT SmartCA');
  }
  if (!/^\d{9,13}$/.test(id)) {
    throw new ValidationError('CCCD/MST SmartCA không hợp lệ (9–13 chữ số)');
  }
  return id;
};

/**
 * Kiểm tra chứng thư VNPT SmartCA rồi lưu thuê bao vào hồ sơ cán bộ.
 */
export const verifyAndLinkMySmartCa = async (userId, body = {}) => {
  const user = await userRepository.findById(userId);
  assertStaffCanLinkSmartCa(user);

  const smartCaUserId = assertValidSmartCaUserId(body.smartCaUserId ?? body.userId);

  const {
    getCertificate,
    pickCertificateSerial,
    pickCertificateSubject,
    isVnptSmartCaConfigured,
  } = await import('../signatures/vnptSmartCa.client.js');

  let certSubject = '';
  let certSerial = '';

  if (isVnptSmartCaConfigured()) {
    const certData = await getCertificate(smartCaUserId);
    certSerial = pickCertificateSerial(certData);
    certSubject = pickCertificateSubject(
      certData,
      `CN=${user.fullName}, E=${user.email}`,
    );
    if (!certSerial) {
      throw new ValidationError(
        `CCCD/MST ${smartCaUserId} chưa có chứng thư số trên VNPT SmartCA. Kiểm tra app SmartCA đã kích hoạt chưa.`,
      );
    }
  } else {
    // Dev: chưa cấu hình gateway — vẫn cho lưu ID để test UI
    certSubject = `CN=${user.fullName}, E=${user.email} (chưa verify live)`;
  }

  const updated = await userRepository.updateMe(userId, {
    smartCaUserId,
    smartCaVerifiedAt: new Date(),
    smartCaCertSubject: certSubject,
  });
  return formatAccountUser(updated);
};

export const unlinkMySmartCa = async (userId) => {
  const user = await userRepository.findById(userId);
  assertStaffCanLinkSmartCa(user);

  const updated = await userRepository.updateMe(userId, {
    smartCaUserId: '',
    smartCaVerifiedAt: null,
    smartCaCertSubject: '',
  });
  return formatAccountUser(updated);
};

const verifyGoogleIdentity = async (idToken) => {
  if (!config.google.clientId) {
    throw new ValidationError('Liên kết Google chưa được cấu hình trên hệ thống');
  }
  if (!idToken || typeof idToken !== 'string') {
    throw new ValidationError('Thiếu thông tin xác thực Google');
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: config.google.clientId,
  });
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

export const linkGoogleAccount = async (userId, { idToken }) => {
  const user = await userRepository.findByIdWithGoogleMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');

  const googleIdentity = await verifyGoogleIdentity(idToken);
  assertEmailByRole(googleIdentity.email, user.role);
  if (googleIdentity.email !== user.email) {
    throw new ValidationError('Email Google phải trùng với email tài khoản trong hệ thống');
  }

  const updated = await userRepository.updateMe(userId, {
    googleSub: googleIdentity.sub,
    googleEmail: googleIdentity.email,
    googlePicture: googleIdentity.picture,
    googleLinkedAt: new Date(),
  });
  return formatAccountUser(updated);
};

export const unlinkGoogleAccount = async (userId) => {
  const user = await userRepository.findByIdWithGoogleMeta(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');
  if (!user.googleSub || !user.googleLinkedAt) {
    throw new ValidationError('Tài khoản chưa liên kết Google');
  }

  const updated = await userRepository.unlinkGoogleMeta(userId);
  return formatAccountUser(updated);
};

