import mongoose from 'mongoose';
import { CTUT_EMAIL_REGEX, CTUT_EMAIL_MESSAGE } from '../../../shared/validators/ctutEmail.js';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from '../../../shared/validators/phoneText.js';
import {
  ORG_CODE_REGEX,
  ORG_NAME_REGEX,
} from '../../../shared/validators/organizationText.js';

const optionalPhone = {
  type: String,
  default: '',
  validate: {
    validator(value) {
      if (!value) return true;
      return PHONE_REGEX.test(value);
    },
    message: PHONE_INVALID_MESSAGE,
  },
};

const sinhVienSchema = new mongoose.Schema(
  {
    maSV: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 15,
      validate: {
        validator: (value) => ORG_CODE_REGEX.test(value),
        message: 'Mã SV không được chứa ký tự đặc biệt',
      },
    },
    maHoSo: { type: String, trim: true, maxlength: 50, default: '' },
    fullName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      validate: {
        validator: (value) => ORG_NAME_REGEX.test(value),
        message: 'Họ tên không được chứa ký tự đặc biệt',
      },
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', '', null],
      default: null,
    },
    status: { type: String, trim: true, maxlength: 100, default: '' },
    ngayVaoTruong: { type: Date, default: null },
    lopHoc: { type: String, trim: true, maxlength: 100, default: '' },
    coSo: { type: String, trim: true, maxlength: 100, default: '' },
    dienDaoTao: { type: String, trim: true, maxlength: 100, default: '' },
    loaiHinhDaoTao: { type: String, trim: true, maxlength: 100, default: '' },
    nganh: { type: String, trim: true, maxlength: 150, default: '' },
    chuyenNganh: { type: String, trim: true, maxlength: 150, default: '' },
    khoaHoc: { type: String, trim: true, maxlength: 50, default: '' },
    dateOfBirth: { type: Date, default: null },
    danToc: { type: String, trim: true, maxlength: 50, default: '' },
    tonGiao: { type: String, trim: true, maxlength: 50, default: '' },
    quocTich: { type: String, trim: true, maxlength: 50, default: 'Việt Nam' },
    khuVuc: { type: String, trim: true, maxlength: 50, default: '' },
    soCCCD: { type: String, trim: true, maxlength: 20, default: '' },
    ngayCapCCCD: { type: Date, default: null },
    noiCapCCCD: { type: String, trim: true, maxlength: 150, default: '' },
    doiTuong: { type: String, trim: true, maxlength: 100, default: '' },
    chinhSach: { type: String, trim: true, maxlength: 100, default: '' },
    ngayVaoDoan: { type: Date, default: null },
    ngayVaoDang: { type: Date, default: null },
    email: {
      type: String,
      required: [true, 'Vui lòng nhập Email'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => CTUT_EMAIL_REGEX.test(value),
        message: CTUT_EMAIL_MESSAGE,
      },
    },
    phone: optionalPhone,
    diaChiLienHe: { type: String, trim: true, maxlength: 255, default: '' },
    noiSinh: { type: String, trim: true, maxlength: 255, default: '' },
    diaChiThuongTru: { type: String, trim: true, maxlength: 255, default: '' },
    tenNganHang: { type: String, trim: true, maxlength: 100, default: '' },
    tenChiNhanh: { type: String, trim: true, maxlength: 150, default: '' },
    tenChuTaiKhoan: { type: String, trim: true, maxlength: 100, default: '' },
    soTaiKhoan: { type: String, trim: true, maxlength: 50, default: '' },
    hoTenCha: { type: String, trim: true, maxlength: 100, default: '' },
    namSinhCha: { type: String, trim: true, maxlength: 4, default: '' },
    ngheNgiepCha: { type: String, trim: true, maxlength: 100, default: '' },
    sdtCha: optionalPhone,
    hoTenMe: { type: String, trim: true, maxlength: 100, default: '' },
    namSinhMe: { type: String, trim: true, maxlength: 4, default: '' },
    ngheNgiepMe: { type: String, trim: true, maxlength: 100, default: '' },
    sdtMe: optionalPhone,
    nguyenQuan: { type: String, trim: true, maxlength: 255, default: '' },
    quanHuyen: { type: String, trim: true, maxlength: 150, default: '' },
    phuongXa: { type: String, trim: true, maxlength: 150, default: '' },
    tenTinh: { type: String, trim: true, maxlength: 150, default: '' },
    tenHuyen: { type: String, trim: true, maxlength: 150, default: '' },
    tenPhanHe: { type: String, trim: true, maxlength: 100, default: '' },
    truongTotNghiep: { type: String, trim: true, maxlength: 255, default: '' },
    nienKhoa: { type: String, trim: true, maxlength: 50, default: '' },
    ghiChu: { type: String, trim: true, maxlength: 500, default: '' },
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', required: true },
    boMonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoMon', required: true },
    lopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lop', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sinhVienSchema.index({ lopId: 1, isActive: 1 });
sinhVienSchema.index({ khoaId: 1, boMonId: 1 });
sinhVienSchema.index({ fullName: 'text', maSV: 'text', email: 'text', maHoSo: 'text' });

const SinhVien = mongoose.model('SinhVien', sinhVienSchema);
export default SinhVien;
