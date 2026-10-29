import mongoose from 'mongoose';
import User from '../users/user.model.js';
import Khoa from './models/khoa.model.js';
import BoMon from './models/boMon.model.js';
import Lop from './models/lop.model.js';
import SinhVien from './models/sinhVien.model.js';
import GiangVien from './models/giangVien.model.js';
import GiangVienQuyen from './models/giangVienQuyen.model.js';
import { QUYEN_CODE_TO_ROLE, QUYEN_ROLE_PRIORITY } from './models/quyen.model.js';
import Quyen from './models/quyen.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES } from '../../config/roles.js';
import { ValidationError } from '../../shared/errors/AppError.js';
import { assertValidOrgCode, assertMaxLengthOrgCode } from '../../shared/validators/organizationText.js';
import { assertExclusiveLeadershipRole } from '../users/leadershipUniqueness.js';
import { generateGiangVienMa, generateMaHoSo, generateSinhVienMa } from './orgCodeGenerate.js';

export const ORG_SYNC_DEFAULT_PASSWORD = 'Pmtthc@123';

const STAFF_ROLES_NEED_GIANG_VIEN = new Set([ROLES.LECTURER]);

const resolveRoleFromGiangVienQuyens = async (giangVienId, currentRole) => {
  const rows = await GiangVienQuyen.find({ giangVienId, isActive: true }).populate('quyenId', 'code');
  let bestRole = null;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const code = row.quyenId?.code;
    if (!code || !QUYEN_CODE_TO_ROLE[code]) continue;
    const rank = QUYEN_ROLE_PRIORITY.indexOf(code);
    const effectiveRank = rank === -1 ? 999 : rank;
    if (effectiveRank < bestRank) {
      bestRank = effectiveRank;
      bestRole = QUYEN_CODE_TO_ROLE[code];
    }
  }

  if (bestRole) return bestRole;

  // Không có quyền tổ chức map role → giữ role hiện tại (CVHT không đổi User.role)
  if (
    currentRole &&
    currentRole !== ROLES.STUDENT &&
    currentRole !== ROLES.ADMIN &&
    currentRole !== ROLES.ACADEMIC_ADVISOR
  ) {
    return currentRole;
  }

  return ROLES.LECTURER;
};

const loadOrgNames = async (khoaId, boMonId) => {
  const [khoa, boMon] = await Promise.all([
    khoaId ? Khoa.findById(khoaId).select('name') : null,
    boMonId ? BoMon.findById(boMonId).select('name') : null,
  ]);
  return {
    faculty: khoa?.name || '',
    department: boMon?.name || '',
  };
};

const findLinkedUser = async ({ email, sinhVienId, giangVienId, studentId, userId }) => {
  if (userId) {
    const byId = await User.findById(userId);
    if (byId) return byId;
  }
  if (sinhVienId) {
    const bySinhVien = await User.findOne({ sinhVienId });
    if (bySinhVien) return bySinhVien;
  }
  if (giangVienId) {
    const byGiangVien = await User.findOne({ giangVienId });
    if (byGiangVien) return byGiangVien;
  }
  if (studentId) {
    const byStudentId = await User.findOne({ studentId: String(studentId).trim() });
    if (byStudentId) return byStudentId;
  }
  if (email) {
    return User.findOne({ email: String(email).trim().toLowerCase() });
  }
  return null;
};

const assertCanSyncUser = (existingUser, { expectedRole, sinhVienId, giangVienId }) => {
  if (!existingUser) return;

  if (
    sinhVienId &&
    existingUser.sinhVienId &&
    existingUser.sinhVienId.toString() !== String(sinhVienId)
  ) {
    throw new ValidationError('Email đã được sử dụng bởi tài khoản sinh viên khác');
  }

  if (
    giangVienId &&
    existingUser.giangVienId &&
    existingUser.giangVienId.toString() !== String(giangVienId)
  ) {
    throw new ValidationError('Email đã được sử dụng bởi tài khoản giảng viên khác');
  }

  if (existingUser.role === ROLES.ADMIN) {
    throw new ValidationError('Email đã được sử dụng bởi tài khoản quản trị');
  }

  const linkedToSameOrg =
    (sinhVienId && existingUser.sinhVienId?.toString() === String(sinhVienId)) ||
    (giangVienId && existingUser.giangVienId?.toString() === String(giangVienId));

  if (!linkedToSameOrg && existingUser.role !== expectedRole) {
    throw new ValidationError('Email đã được sử dụng bởi tài khoản khác trong hệ thống');
  }
};

/** Cùng mật khẩu mặc định — băm một lần cho cả đợt tạo tài khoản. */
let defaultPasswordHashPromise = null;
const getDefaultPasswordHash = () => {
  if (!defaultPasswordHashPromise) {
    defaultPasswordHashPromise = hashPassword(ORG_SYNC_DEFAULT_PASSWORD);
  }
  return defaultPasswordHashPromise;
};

const upsertUser = async (existingUser, payload, { unsetFields = [] } = {}) => {
  const buildUpdateDoc = (basePayload) => {
    const updateDoc = { ...basePayload };
    if (unsetFields.length > 0) {
      updateDoc.$unset = unsetFields.reduce((acc, field) => {
        acc[field] = 1;
        delete updateDoc[field];
        return acc;
      }, {});
    }
    return updateDoc;
  };

  if (existingUser) {
    return User.findByIdAndUpdate(existingUser._id, buildUpdateDoc(payload), {
      new: true,
      runValidators: true,
    });
  }

  const normalizedEmail = String(payload.email || '')
    .trim()
    .toLowerCase();
  if (normalizedEmail) {
    const byEmail = await User.findOne({ email: normalizedEmail });
    if (byEmail) {
      return User.findByIdAndUpdate(byEmail._id, buildUpdateDoc(payload), {
        new: true,
        runValidators: true,
      });
    }
  }

  const hashedPassword = await getDefaultPasswordHash();
  return User.create({
    ...payload,
    password: hashedPassword,
    mustChangePassword: true,
  });
};

/** Email User phải trống (hoặc thuộc chính user đang sync). */
const assertUserEmailAvailable = async (email, excludeUserId) => {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return;
  const clash = await User.findOne({
    email: normalized,
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  }).select('_id');
  if (clash) {
    throw new ValidationError('Email đã được sử dụng bởi tài khoản khác trong hệ thống');
  }
};

/** Email / mã SV trên SinhVien phải trống (hoặc thuộc chính bản ghi đang sync). */
const assertSinhVienIdentityAvailable = async ({ email, maSV, excludeSinhVienId }) => {
  if (email) {
    const clashEmail = await SinhVien.findOne({
      email: String(email).trim().toLowerCase(),
      ...(excludeSinhVienId ? { _id: { $ne: excludeSinhVienId } } : {}),
    }).select('_id');
    if (clashEmail) {
      throw new ValidationError('Email đã được sử dụng bởi hồ sơ sinh viên khác');
    }
  }
  if (maSV) {
    const clashMa = await SinhVien.findOne({
      maSV: String(maSV).trim().toUpperCase(),
      ...(excludeSinhVienId ? { _id: { $ne: excludeSinhVienId } } : {}),
    }).select('_id');
    if (clashMa) {
      throw new ValidationError(`Mã SV ${String(maSV).trim().toUpperCase()} đã tồn tại`);
    }
  }
};

const resolveSinhVienLinkedToUser = async (userDoc) => {
  if (!userDoc) return null;
  if (userDoc.sinhVienId) {
    const byId = await SinhVien.findById(userDoc.sinhVienId);
    if (byId) return byId;
  }
  if (userDoc.studentId) {
    const byMa = await SinhVien.findOne({ maSV: String(userDoc.studentId).trim().toUpperCase() });
    if (byMa) return byMa;
  }
  if (userDoc.email) {
    const byEmail = await SinhVien.findOne({
      email: String(userDoc.email).trim().toLowerCase(),
    });
    if (byEmail) return byEmail;
  }
  return null;
};

export const syncUserFromSinhVien = async (sinhVienDoc) => {
  if (!sinhVienDoc?.email || sinhVienDoc.isActive === false) return null;

  const sinhVienId = sinhVienDoc._id;
  const email = String(sinhVienDoc.email).trim().toLowerCase();
  const existingUser = await findLinkedUser({
    email,
    sinhVienId,
    studentId: sinhVienDoc.maSV,
  });
  assertCanSyncUser(existingUser, { expectedRole: ROLES.STUDENT, sinhVienId });
  await assertUserEmailAvailable(email, existingUser?._id);

  const { faculty, department } = await loadOrgNames(sinhVienDoc.khoaId, sinhVienDoc.boMonId);
  const user = await upsertUser(
    existingUser,
    {
      email,
      fullName: sinhVienDoc.fullName,
      role: ROLES.STUDENT,
      studentId: sinhVienDoc.maSV,
      phone: sinhVienDoc.phone || '',
      gender: sinhVienDoc.gender || null,
      dateOfBirth: sinhVienDoc.dateOfBirth || null,
      address: sinhVienDoc.diaChiLienHe || '',
      khoaId: sinhVienDoc.khoaId,
      boMonId: sinhVienDoc.boMonId,
      lopId: sinhVienDoc.lopId,
      sinhVienId,
      giangVienId: null,
      faculty,
      department,
      isActive: true,
    },
    { unsetFields: ['giangVienId'] },
  );

  if (!sinhVienDoc.userId || sinhVienDoc.userId.toString() !== user._id.toString()) {
    await SinhVien.findByIdAndUpdate(sinhVienId, { userId: user._id });
  }

  return user;
};

/** Đồng bộ nhiều hồ sơ sinh viên sang tài khoản. Không đổi mật khẩu tài khoản đã có. */
export const bulkSyncStudentUsers = async (sinhVienDocs) => {
  const docs = (sinhVienDocs || []).filter((sv) => sv?.email && sv.isActive !== false);
  if (!docs.length) return;

  const hash = await getDefaultPasswordHash();
  const users = await User.find({}).select('_id email sinhVienId studentId role').lean();

  const byEmail = new Map(users.map((user) => [String(user.email || '').toLowerCase(), user]));
  const bySv = new Map(
    users.filter((user) => user.sinhVienId).map((user) => [String(user.sinhVienId), user]),
  );
  const byMa = new Map(
    users.filter((user) => user.studentId).map((user) => [String(user.studentId).toUpperCase(), user]),
  );

  const [khoas, boMons] = await Promise.all([
    Khoa.find({ _id: { $in: docs.map((sv) => sv.khoaId) } }).select('name').lean(),
    BoMon.find({ _id: { $in: docs.map((sv) => sv.boMonId) } }).select('name').lean(),
  ]);
  const khoaName = new Map(khoas.map((khoa) => [String(khoa._id), khoa.name]));
  const boMonName = new Map(boMons.map((boMon) => [String(boMon._id), boMon.name]));

  const ops = [];
  const linkBack = [];
  for (const sv of docs) {
    const email = String(sv.email).trim().toLowerCase();
    const existing = bySv.get(String(sv._id)) || byMa.get(String(sv.maSV).toUpperCase()) || byEmail.get(email);
    if (existing?.role === ROLES.ADMIN) continue;

    const set = {
      email,
      fullName: sv.fullName,
      role: ROLES.STUDENT,
      studentId: sv.maSV,
      phone: sv.phone || '',
      gender: sv.gender || null,
      dateOfBirth: sv.dateOfBirth || null,
      address: sv.diaChiLienHe || '',
      khoaId: sv.khoaId,
      boMonId: sv.boMonId,
      lopId: sv.lopId,
      sinhVienId: sv._id,
      faculty: khoaName.get(String(sv.khoaId)) || '',
      department: boMonName.get(String(sv.boMonId)) || '',
      isActive: true,
    };

    if (existing) {
      ops.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: set, $unset: { giangVienId: 1 } },
        },
      });
      linkBack.push({ svId: sv._id, userId: existing._id });
    } else {
      const userId = new mongoose.Types.ObjectId();
      ops.push({
        insertOne: {
          document: {
            _id: userId,
            ...set,
            password: hash,
            mustChangePassword: true,
          },
        },
      });
      linkBack.push({ svId: sv._id, userId });
      const created = { _id: userId, email, role: ROLES.STUDENT, studentId: sv.maSV, sinhVienId: sv._id };
      byEmail.set(email, created);
      byMa.set(String(sv.maSV).toUpperCase(), created);
      bySv.set(String(sv._id), created);
    }
  }

  const chunk = 500;
  for (let i = 0; i < ops.length; i += chunk) {
    await User.bulkWrite(ops.slice(i, i + chunk), { ordered: false });
  }
  for (let i = 0; i < linkBack.length; i += chunk) {
    await SinhVien.bulkWrite(
      linkBack.slice(i, i + chunk).map((row) => ({
        updateOne: {
          filter: { _id: row.svId },
          update: { $set: { userId: row.userId } },
        },
      })),
      { ordered: false },
    );
  }
};

/**
 * Đẩy các trường trùng từ User → SinhVien.
 * Trả về bản ghi SV đã cập nhật, hoặc null nếu chưa có SV liên kết.
 */
export const syncSinhVienFromUser = async (userDoc) => {
  if (!userDoc?._id || userDoc.role !== ROLES.STUDENT) return null;

  const sv = await resolveSinhVienLinkedToUser(userDoc);
  if (!sv) return null;

  const email = String(userDoc.email || sv.email || '')
    .trim()
    .toLowerCase();

  if (!email) throw new ValidationError('Thiếu email để đồng bộ hồ sơ sinh viên');

  await assertSinhVienIdentityAvailable({
    email: email !== String(sv.email || '').toLowerCase() ? email : null,
    maSV: null,
    excludeSinhVienId: sv._id,
  });

  let khoaId = userDoc.khoaId || sv.khoaId;
  let boMonId = userDoc.boMonId || sv.boMonId;
  let lopId = userDoc.lopId || sv.lopId;

  if (userDoc.lopId) {
    const lop = await Lop.findById(userDoc.lopId).select('khoaId boMonId name');
    if (!lop) throw new ValidationError('Lớp không tồn tại');
    lopId = lop._id;
    khoaId = userDoc.khoaId || lop.khoaId;
    boMonId = userDoc.boMonId || lop.boMonId;
    if (!sv.lopHoc && lop.name) sv.lopHoc = lop.name;
  }

  // maSV hệ thống — không đổi từ User.studentId / preview client
  if (!sv.maHoSo) {
    sv.maHoSo = await generateMaHoSo();
  }
  sv.fullName = userDoc.fullName || sv.fullName;
  sv.email = email;
  if (userDoc.phone != null) sv.phone = userDoc.phone || '';
  if (userDoc.gender !== undefined) sv.gender = userDoc.gender || null;
  if (userDoc.dateOfBirth !== undefined) sv.dateOfBirth = userDoc.dateOfBirth || null;
  if (userDoc.address != null) sv.diaChiLienHe = userDoc.address || '';
  if (khoaId) sv.khoaId = khoaId;
  if (boMonId) sv.boMonId = boMonId;
  if (lopId) sv.lopId = lopId;
  if (userDoc.isActive === false) sv.isActive = false;
  else if (userDoc.isActive === true) sv.isActive = true;
  sv.userId = userDoc._id;

  await sv.save();
  return sv;
};

/**
 * Đảm bảo User student luôn có bản ghi SinhVien đồng bộ.
 * Tạo mới nếu chưa có (bắt buộc lopId + email + fullName; mã SV/hồ sơ do server sinh).
 */
export const ensureSinhVienForStudentUser = async (userDoc) => {
  if (!userDoc?._id || userDoc.role !== ROLES.STUDENT) return userDoc;

  let sv = await syncSinhVienFromUser(userDoc);

  if (!sv) {
    if (!userDoc.lopId) {
      throw new ValidationError(
        'Vui lòng chọn lớp để tạo hồ sơ sinh viên đồng bộ (Lớp & Sinh viên)',
      );
    }
    // Mã do server sinh — không dùng studentId/preview từ client
    const maSV = await generateSinhVienMa(userDoc.lopId);
    const maHoSo = await generateMaHoSo();
    const email = String(userDoc.email || '')
      .trim()
      .toLowerCase();
    const fullName = String(userDoc.fullName || '').trim();
    if (!email) throw new ValidationError('Vui lòng nhập email sinh viên');
    if (!fullName) throw new ValidationError('Vui lòng nhập họ tên sinh viên');

    assertValidOrgCode(maSV, 'Mã SV');
    assertMaxLengthOrgCode(maSV, 'Mã SV');

    const lop = await Lop.findById(userDoc.lopId);
    if (!lop) throw new ValidationError('Lớp không tồn tại');

    await assertSinhVienIdentityAvailable({ email, maSV });

    const khoaId = userDoc.khoaId || lop.khoaId;
    const boMonId = userDoc.boMonId || lop.boMonId;

    sv = await SinhVien.create({
      maSV,
      maHoSo,
      fullName,
      email,
      phone: userDoc.phone || '',
      gender: userDoc.gender || null,
      dateOfBirth: userDoc.dateOfBirth || null,
      diaChiLienHe: userDoc.address || '',
      khoaId,
      boMonId,
      lopId: lop._id,
      lopHoc: lop.name || '',
      userId: userDoc._id,
      isActive: userDoc.isActive !== false,
    });
  }

  const { faculty, department } = await loadOrgNames(sv.khoaId, sv.boMonId);
  return User.findByIdAndUpdate(
    userDoc._id,
    {
      sinhVienId: sv._id,
      studentId: sv.maSV,
      fullName: sv.fullName,
      email: sv.email,
      phone: sv.phone || '',
      gender: sv.gender || null,
      dateOfBirth: sv.dateOfBirth || null,
      address: sv.diaChiLienHe || '',
      khoaId: sv.khoaId,
      boMonId: sv.boMonId,
      lopId: sv.lopId,
      faculty,
      department,
      giangVienId: null,
    },
    { new: true, runValidators: true },
  );
};

/** Khóa/mở khóa SinhVien khi đổi trạng thái User student. */
export const syncSinhVienActiveFromUser = async (userDoc, isActive) => {
  if (!userDoc?._id || userDoc.role !== ROLES.STUDENT) return null;
  const sv = await resolveSinhVienLinkedToUser(userDoc);
  if (!sv) return null;
  if (sv.isActive === isActive) return sv;
  sv.isActive = isActive;
  await sv.save();
  if (isActive) {
    await syncUserFromSinhVien(sv);
  }
  return sv;
};

export const syncUserFromGiangVien = async (giangVienDoc, { preferUserId } = {}) => {
  if (!giangVienDoc?.email || giangVienDoc.isActive === false) return null;

  const giangVienId = giangVienDoc._id;
  const email = String(giangVienDoc.email).trim().toLowerCase();
  const existingUser = await findLinkedUser({
    email,
    giangVienId,
    userId: preferUserId || giangVienDoc.userId,
  });
  const role = await resolveRoleFromGiangVienQuyens(giangVienId, existingUser?.role);
  assertCanSyncUser(existingUser, { expectedRole: role, giangVienId });

  let { faculty, department } = await loadOrgNames(giangVienDoc.khoaId, giangVienDoc.boMonId);
  let khoaId = giangVienDoc.khoaId || null;
  let boMonId = giangVienDoc.boMonId || null;

  // Khớp rule form Người dùng: cấp trường / khoa / phòng / trung tâm
  if (role === ROLES.PRINCIPAL || role === ROLES.VICE_PRINCIPAL) {
    khoaId = null;
    boMonId = null;
    faculty = '';
    department = '';
  } else if (
    role === ROLES.FACULTY_MANAGER ||
    role === ROLES.DEPUTY_FACULTY_MANAGER ||
    role === ROLES.KHOA_ASSISTANT
  ) {
    boMonId = null;
    department = '';
  } else if (
    role === ROLES.DEPARTMENT_HEAD ||
    role === ROLES.DEPUTY_DEPARTMENT_HEAD ||
    role === ROLES.CENTER_DIRECTOR ||
    role === ROLES.DEPUTY_CENTER_DIRECTOR ||
    role === ROLES.PHONG_ASSISTANT ||
    role === ROLES.TRUNG_TAM_ASSISTANT ||
    role === ROLES.OFFICE_STAFF
  ) {
    khoaId = null;
    boMonId = null;
    faculty = '';
    // department giữ tên phòng/đơn vị nếu có
  }

  await assertExclusiveLeadershipRole(
    {
      role,
      khoaId,
      boMonId,
      department,
      isActive: true,
    },
    { excludeUserId: existingUser?._id },
  );

  const user = await upsertUser(
    existingUser,
    {
      email,
      fullName: giangVienDoc.fullName,
      role,
      phone: giangVienDoc.phone || '',
      khoaId,
      boMonId,
      lopId: null,
      sinhVienId: null,
      giangVienId,
      faculty,
      department,
      isActive: true,
    },
    { unsetFields: ['studentId', 'lopId', 'sinhVienId'] },
  );

  if (!giangVienDoc.userId || giangVienDoc.userId.toString() !== user._id.toString()) {
    await GiangVien.findByIdAndUpdate(giangVienId, { userId: user._id });
  }

  return user;
};

/** Khóa User khi soft-delete Sinh viên / Giảng viên */
export const deactivateUserLinkedToOrg = async ({ userId, sinhVienId, giangVienId }) => {
  const user =
    (userId ? await User.findById(userId) : null) ||
    (await findLinkedUser({ sinhVienId, giangVienId }));
  if (!user || user.role === ROLES.ADMIN) return null;
  if (!user.isActive) return user;
  user.isActive = false;
  await user.save();
  return user;
};

const ensureQuyenAssignment = async (giangVienId, quyenCode, { khoaId, boMonId } = {}) => {
  const quyen = await Quyen.findOne({ code: quyenCode, isActive: true });
  if (!quyen) return;
  const existing = await GiangVienQuyen.findOne({ giangVienId, quyenId: quyen._id });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.khoaId = khoaId || existing.khoaId || null;
      existing.boMonId = boMonId || existing.boMonId || null;
      await existing.save();
    }
    return;
  }
  await GiangVienQuyen.create({
    giangVienId,
    quyenId: quyen._id,
    khoaId: khoaId || null,
    boMonId: boMonId || null,
    isActive: true,
  });
};

/** Tạo/cập nhật bản ghi GiangVien liên kết User (không đổi User.role). */
const upsertGiangVienForUser = async (userDoc, { khoaId, boMonId } = {}) => {
  if (!khoaId || !boMonId) {
    throw new ValidationError('Cần chọn Khoa và Bộ môn');
  }

  const boMon = await BoMon.findById(boMonId).select('khoaId');
  if (!boMon) throw new ValidationError('Bộ môn không tồn tại');
  if (String(boMon.khoaId) !== String(khoaId)) {
    throw new ValidationError('Bộ môn không thuộc khoa đã chọn');
  }

  const email = String(userDoc.email || '').trim().toLowerCase();
  if (!email) throw new ValidationError('Thiếu email để đồng bộ giảng viên');

  let gv =
    (userDoc.giangVienId ? await GiangVien.findById(userDoc.giangVienId) : null) ||
    (await GiangVien.findOne({ email }));

  if (!gv) {
    const allocatedMa = await generateGiangVienMa(khoaId);
    gv = await GiangVien.create({
      maGV: allocatedMa,
      fullName: userDoc.fullName,
      email,
      phone: userDoc.phone || '',
      khoaId,
      boMonId,
      userId: userDoc._id,
      isActive: userDoc.isActive !== false,
    });
  } else {
    gv.fullName = userDoc.fullName || gv.fullName;
    gv.phone = userDoc.phone != null ? userDoc.phone : gv.phone;
    gv.khoaId = khoaId;
    gv.boMonId = boMonId;
    gv.userId = userDoc._id;
    gv.isActive = userDoc.isActive !== false;
    // Mã GV hệ thống — không đổi theo preview/client
    await gv.save();
  }

  return gv;
};

/**
 * Khi tạo/sửa User giảng viên: tạo/cập nhật bản ghi GiangVien đồng bộ trang Giảng viên.
 */
export const ensureGiangVienForStaffUser = async (userDoc, options = {}) => {
  if (!userDoc?._id || !STAFF_ROLES_NEED_GIANG_VIEN.has(userDoc.role)) {
    return userDoc;
  }

  const khoaId = options.khoaId || userDoc.khoaId;
  const boMonId = options.boMonId || userDoc.boMonId;
  const gv = await upsertGiangVienForUser(userDoc, {
    khoaId,
    boMonId,
  });

  await ensureQuyenAssignment(gv._id, 'giang_vien', { khoaId, boMonId });
  await syncUserFromGiangVien(gv, { preferUserId: userDoc._id });

  const { faculty, department } = await loadOrgNames(khoaId, boMonId);
  return User.findByIdAndUpdate(
    userDoc._id,
    {
      giangVienId: gv._id,
      sinhVienId: null,
      studentId: null,
      lopId: null,
      khoaId,
      boMonId,
      faculty,
      department,
    },
    { new: true, runValidators: true },
  );
};

/**
 * Gán nhiệm vụ cố vấn học tập (không đổi User.role).
 * Tạo/liên kết GiangVien + gán lớp cố vấn + quyền co_van_hoc_tap.
 */
export const assignAdvisorDutyToUser = async (userDoc, options = {}) => {
  if (!userDoc?._id) return null;
  if (userDoc.role === ROLES.STUDENT || userDoc.role === ROLES.ADMIN) {
    throw new ValidationError('Không thể gán cố vấn cho sinh viên hoặc quản trị viên');
  }

  const khoaId = options.khoaId;
  const boMonId = options.boMonId;
  const lopCoVanIds = options.lopCoVanIds;
  if (!Array.isArray(lopCoVanIds) || lopCoVanIds.length === 0) {
    throw new ValidationError('Vui lòng chọn ít nhất một lớp cố vấn');
  }

  // Role legacy academic_advisor → chuyển sang lecturer (CVHT không còn là role)
  let preservedRole = userDoc.role;
  if (preservedRole === ROLES.ACADEMIC_ADVISOR) {
    preservedRole = ROLES.LECTURER;
  }

  const gv = await upsertGiangVienForUser(userDoc, {
    khoaId,
    boMonId,
  });

  if (preservedRole === ROLES.LECTURER) {
    await ensureQuyenAssignment(gv._id, 'giang_vien', { khoaId, boMonId });
  }

  await applyAdvisorLopsToGiangVien(gv._id, lopCoVanIds);

  const updatePayload = {
    role: preservedRole,
    giangVienId: gv._id,
    sinhVienId: null,
    studentId: null,
    lopId: null,
  };

  // Chỉ ghi khoa/bộ môn lên User khi role cần (giảng viên / legacy)
  if (preservedRole === ROLES.LECTURER) {
    const { faculty, department } = await loadOrgNames(khoaId, boMonId);
    updatePayload.khoaId = khoaId;
    updatePayload.boMonId = boMonId;
    updatePayload.faculty = faculty;
    updatePayload.department = department;
  }

  return User.findByIdAndUpdate(userDoc._id, updatePayload, { new: true, runValidators: true });
};

export const getAdvisorDutyForUser = async (userDoc) => {
  let khoaId = userDoc?.khoaId || null;
  let boMonId = userDoc?.boMonId || null;
  let maGV = null;
  let lopCoVans = [];

  if (userDoc?.giangVienId) {
    const gv = await GiangVien.findById(userDoc.giangVienId).select('khoaId boMonId maGV');
    if (gv) {
      khoaId = gv.khoaId || khoaId;
      boMonId = gv.boMonId || boMonId;
      maGV = gv.maGV || null;
      const lops = await Lop.find({ coVanId: gv._id, isActive: true }).select('_id code name');
      lopCoVans = lops.map((l) => ({
        _id: String(l._id),
        code: l.code || '',
        name: l.name || '',
      }));
    }
  }

  const [khoa, boMon] = await Promise.all([
    khoaId ? Khoa.findById(khoaId).select('code name').lean() : null,
    boMonId ? BoMon.findById(boMonId).select('code name').lean() : null,
  ]);

  return {
    khoaId: khoaId || null,
    boMonId: boMonId || null,
    khoaName: khoa?.name || '',
    khoaCode: khoa?.code || '',
    boMonName: boMon?.name || '',
    boMonCode: boMon?.code || '',
    maGV,
    lopCoVanIds: lopCoVans.map((l) => l._id),
    lopCoVans,
  };
};

/** Gán danh sách lớp cố vấn cho GV — không đổi User.role thành CVHT. */
export const applyAdvisorLopsToGiangVien = async (giangVienId, lopCoVanIds) => {
  if (!giangVienId || lopCoVanIds === undefined) return null;
  const gv = await GiangVien.findById(giangVienId);
  if (!gv) return null;

  const desired = Array.isArray(lopCoVanIds) ? lopCoVanIds.map(String).filter(Boolean) : [];

  await Lop.updateMany(
    { coVanId: giangVienId, ...(desired.length ? { _id: { $nin: desired } } : {}) },
    { $set: { coVanId: null } },
  );
  if (desired.length) {
    await Lop.updateMany({ _id: { $in: desired }, isActive: true }, { $set: { coVanId: giangVienId } });
  }

  const quyen = await Quyen.findOne({ code: 'co_van_hoc_tap' });
  if (quyen) {
    if (desired.length > 0) {
      await ensureQuyenAssignment(giangVienId, 'co_van_hoc_tap', {
        khoaId: gv.khoaId || null,
        boMonId: gv.boMonId || null,
      });
    } else {
      const stillHas = await Lop.exists({ coVanId: giangVienId, isActive: true });
      if (!stillHas) {
        await GiangVienQuyen.updateMany(
          { giangVienId, quyenId: quyen._id },
          { $set: { isActive: false } },
        );
      }
    }
  }

  return syncUserFromGiangVien(gv);
};

export { resolveRoleFromGiangVienQuyens };
