import User from './user.model.js';
import SinhVien from '../organization/models/sinhVien.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import Lop from '../organization/models/lop.model.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import { assertValidPhoneIfProvided } from '../../shared/validators/phoneText.js';
import { normalizeSinhVienIdentityFields } from '../../shared/validators/identityText.js';
import { ROLES } from '../../config/roles.js';

const GENDER_LABELS = { male: 'Nam', female: 'Nữ', other: 'Khác' };

const formatDateDisplay = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('vi-VN');
};

const toIsoDate = (value) => (value ? new Date(value).toISOString() : null);

const parseOptionalDate = (value, label) => {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(`${label} không hợp lệ`);
  }
  return date;
};

const trimStr = (value) => String(value ?? '').trim();

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const emailsMatch = (left, right) => {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  if (!a || !b) return true;
  return a === b;
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

const resolveSinhVienForUser = async (user) => {
  const accountEmail = normalizeEmail(user.email);

  if (user.sinhVienId) {
    const byId = await SinhVien.findById(user.sinhVienId);
    if (byId?.isActive !== false && emailsMatch(byId.email, accountEmail)) {
      return byId;
    }
  }

  if (accountEmail) {
    const byEmail = await SinhVien.findOne({ email: accountEmail, isActive: true });
    if (byEmail) return byEmail;
  }

  if (user.studentId) {
    const byMaSv = await SinhVien.findOne({
      maSV: String(user.studentId).trim().toUpperCase(),
      isActive: true,
    });
    if (byMaSv && emailsMatch(byMaSv.email, accountEmail)) {
      return byMaSv;
    }
  }

  return null;
};

/** Sửa liên kết studentId/sinhVienId khi tài khoản login khớp email nhưng mã SV cũ bị lệch. */
export const ensureStudentUserLinked = async (user) => {
  if (!user || user.role !== ROLES.STUDENT) return user;

  const sinhVien = await resolveSinhVienForUser(user);
  if (!sinhVien) return user;

  const needsRepair =
    user.sinhVienId?.toString() !== sinhVien._id.toString() ||
    String(user.studentId || '').toUpperCase() !== String(sinhVien.maSV || '').toUpperCase() ||
    String(user.fullName || '') !== String(sinhVien.fullName || '') ||
    String(user.phone || '') !== String(sinhVien.phone || '') ||
    String(user.address || '') !== String(sinhVien.diaChiLienHe || '') ||
    String(user.gender || '') !== String(sinhVien.gender || '') ||
    String(user.khoaId || '') !== String(sinhVien.khoaId || '') ||
    String(user.boMonId || '') !== String(sinhVien.boMonId || '') ||
    String(user.lopId || '') !== String(sinhVien.lopId || '');

  if (!needsRepair) return user;

  const { faculty, department } = await loadOrgNames(sinhVien.khoaId, sinhVien.boMonId);
  const repairedUser = await User.findByIdAndUpdate(
    user._id,
    {
      sinhVienId: sinhVien._id,
      studentId: sinhVien.maSV,
      fullName: sinhVien.fullName || user.fullName,
      phone: sinhVien.phone || user.phone || '',
      gender: sinhVien.gender || user.gender || null,
      dateOfBirth: sinhVien.dateOfBirth || user.dateOfBirth || null,
      address: sinhVien.diaChiLienHe || user.address || '',
      khoaId: sinhVien.khoaId,
      boMonId: sinhVien.boMonId,
      lopId: sinhVien.lopId,
      faculty,
      department,
    },
    { new: true, runValidators: true },
  );

  if (!sinhVien.userId || sinhVien.userId.toString() !== repairedUser._id.toString()) {
    await SinhVien.findByIdAndUpdate(sinhVien._id, { userId: repairedUser._id });
  }

  return repairedUser;
};

/** Các trường sinh viên được phép tự cập nhật (khớp form admin, trừ mã SV/email/học vụ) */
const STUDENT_EDITABLE_FIELDS = [
  'maHoSo',
  'gender',
  'dateOfBirth',
  'danToc',
  'tonGiao',
  'quocTich',
  'khuVuc',
  'soCCCD',
  'ngayCapCCCD',
  'noiCapCCCD',
  'doiTuong',
  'chinhSach',
  'ngayVaoDoan',
  'ngayVaoDang',
  'phone',
  'diaChiLienHe',
  'noiSinh',
  'diaChiThuongTru',
  'tenNganHang',
  'tenChiNhanh',
  'tenChuTaiKhoan',
  'soTaiKhoan',
  'hoTenCha',
  'namSinhCha',
  'ngheNgiepCha',
  'sdtCha',
  'hoTenMe',
  'namSinhMe',
  'ngheNgiepMe',
  'sdtMe',
];

const DATE_FIELDS = new Set([
  'dateOfBirth',
  'ngayCapCCCD',
  'ngayVaoDoan',
  'ngayVaoDang',
]);

const PHONE_FIELDS = new Set(['phone', 'sdtCha', 'sdtMe']);

const mapToStudentProfile = async (user, sinhVien) => {
  const [khoa, boMon, lop] = await Promise.all([
    sinhVien?.khoaId ? Khoa.findById(sinhVien.khoaId).select('name code') : null,
    sinhVien?.boMonId ? BoMon.findById(sinhVien.boMonId).select('name code') : null,
    sinhVien?.lopId ? Lop.findById(sinhVien.lopId).select('name code academicYear') : null,
  ]);

  const sv = sinhVien || {};

  return {
    hasSinhVienRecord: Boolean(sinhVien),
    avatar: user.avatar || user.googlePicture || '',

    // Thông tin chung — chỉ đọc
    maSV: sv.maSV || user.studentId || '',
    maHoSo: sv.maHoSo || '',
    fullName: sv.fullName || user.fullName || '',
    gender: sv.gender || user.gender || null,
    genderDisplay: GENDER_LABELS[sv.gender] || GENDER_LABELS[user.gender] || '',
    status: sv.status || '',
    ngayVaoTruong: toIsoDate(sv.ngayVaoTruong),
    ngayVaoTruongDisplay: formatDateDisplay(sv.ngayVaoTruong),
    lopHoc: sv.lopHoc || '',
    coSo: sv.coSo || '',
    dienDaoTao: sv.dienDaoTao || '',
    loaiHinhDaoTao: sv.loaiHinhDaoTao || '',
    nganh: sv.nganh || '',
    chuyenNganh: sv.chuyenNganh || '',
    khoaHoc: sv.khoaHoc || '',
    email: user.email || sv.email || '',
    khoaName: khoa?.name || user.faculty || '',
    boMonName: boMon?.name || user.department || '',
    lopName: lop?.name || '',

    // Cá nhân & CCCD
    dateOfBirth: toIsoDate(sv.dateOfBirth || user.dateOfBirth),
    dateOfBirthDisplay: formatDateDisplay(sv.dateOfBirth || user.dateOfBirth),
    danToc: sv.danToc || '',
    tonGiao: sv.tonGiao || '',
    quocTich: sv.quocTich || 'Việt Nam',
    khuVuc: sv.khuVuc || '',
    soCCCD: sv.soCCCD || '',
    ngayCapCCCD: toIsoDate(sv.ngayCapCCCD),
    ngayCapCCCDDisplay: formatDateDisplay(sv.ngayCapCCCD),
    noiCapCCCD: sv.noiCapCCCD || '',
    doiTuong: sv.doiTuong || '',
    chinhSach: sv.chinhSach || '',
    ngayVaoDoan: toIsoDate(sv.ngayVaoDoan),
    ngayVaoDoanDisplay: formatDateDisplay(sv.ngayVaoDoan),
    ngayVaoDang: toIsoDate(sv.ngayVaoDang),
    ngayVaoDangDisplay: formatDateDisplay(sv.ngayVaoDang),

    // Liên hệ
    phone: sv.phone || user.phone || '',
    diaChiLienHe: sv.diaChiLienHe || user.address || '',
    noiSinh: sv.noiSinh || '',
    diaChiThuongTru: sv.diaChiThuongTru || '',

    // Ngân hàng
    tenNganHang: sv.tenNganHang || '',
    tenChiNhanh: sv.tenChiNhanh || '',
    tenChuTaiKhoan: sv.tenChuTaiKhoan || '',
    soTaiKhoan: sv.soTaiKhoan || '',

    // Gia đình
    hoTenCha: sv.hoTenCha || '',
    namSinhCha: sv.namSinhCha || '',
    ngheNgiepCha: sv.ngheNgiepCha || '',
    sdtCha: sv.sdtCha || '',
    hoTenMe: sv.hoTenMe || '',
    namSinhMe: sv.namSinhMe || '',
    ngheNgiepMe: sv.ngheNgiepMe || '',
    sdtMe: sv.sdtMe || '',
    nguyenQuan: sv.nguyenQuan || '',
    quanHuyen: sv.quanHuyen || '',
    phuongXa: sv.phuongXa || '',
    tenTinh: sv.tenTinh || '',
    tenHuyen: sv.tenHuyen || '',
    tenPhanHe: sv.tenPhanHe || '',
    truongTotNghiep: sv.truongTotNghiep || '',
    nienKhoa: sv.nienKhoa || '',
    ghiChu: sv.ghiChu || '',
  };
};

export const getMyStudentProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('Không tìm thấy tài khoản');
  if (user.role !== ROLES.STUDENT) {
    throw new ForbiddenError('Chỉ sinh viên mới truy cập hồ sơ này');
  }

  const linkedUser = await ensureStudentUserLinked(user);
  const sinhVien = await resolveSinhVienForUser(linkedUser);
  return mapToStudentProfile(linkedUser, sinhVien);
};

const buildSinhVienUpdate = (data) => {
  const svUpdate = {};

  for (const key of STUDENT_EDITABLE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;

    if (DATE_FIELDS.has(key)) {
      svUpdate[key] = parseOptionalDate(data[key], key);
      continue;
    }

    if (PHONE_FIELDS.has(key)) {
      const phone = trimStr(data[key]);
      svUpdate[key] = phone ? assertValidPhoneIfProvided(phone) : '';
      continue;
    }

    if (key === 'soCCCD' || key === 'soTaiKhoan' || key === 'namSinhCha' || key === 'namSinhMe') {
      Object.assign(svUpdate, normalizeSinhVienIdentityFields({ [key]: data[key] }));
      continue;
    }

    if (key === 'gender') {
      const gender = data[key];
      if (gender && !['male', 'female', 'other'].includes(gender)) {
        throw new ValidationError('Giới tính không hợp lệ');
      }
      svUpdate.gender = gender || null;
      continue;
    }

    svUpdate[key] = trimStr(data[key]);
  }

  return svUpdate;
};

export const updateMyStudentProfile = async (userId, data = {}) => {
  throw new ForbiddenError(
    'Sinh viên không được tự cập nhật hồ sơ. Vui lòng liên hệ quản trị viên.',
  );
};
