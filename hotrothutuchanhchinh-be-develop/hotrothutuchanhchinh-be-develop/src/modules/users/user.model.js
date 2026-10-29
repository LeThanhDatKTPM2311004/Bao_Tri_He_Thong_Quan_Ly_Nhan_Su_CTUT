import mongoose from 'mongoose';
import { ROLE_LIST } from '../../config/roles.js';
import {
  isValidCtutEmail,
  isValidStandardEmail,
  CTUT_EMAIL_MESSAGE,
  STANDARD_EMAIL_MESSAGE,
} from '../../shared/validators/ctutEmail.js';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from '../../shared/validators/phoneText.js';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator(value) {
          const role = typeof this.get === 'function' ? this.get('role') : this.role;
          // Chỉ sinh viên bắt buộc @student.ctuet.edu.vn
          if (role === 'student') {
            return isValidCtutEmail(value);
          }
          return isValidStandardEmail(value);
        },
        message() {
          const role = typeof this.get === 'function' ? this.get('role') : this.role;
          return role === 'student' ? CTUT_EMAIL_MESSAGE : STANDARD_EMAIL_MESSAGE;
        },
      },
    },
    password: { type: String, required: true, select: false },
    fullName: { type: String, required: true, trim: true },
    studentId: { type: String, sparse: true, unique: true },
    department: { type: String },
    faculty: { type: String },
    phone: {
      type: String,
      validate: {
        validator(value) {
          if (!value) {
            return true;
          }
          return PHONE_REGEX.test(value);
        },
        message: PHONE_INVALID_MESSAGE,
      },
    },
    avatar: { type: String },
    avatarPublicId: { type: String, default: null, select: false },
    signatureImageUrl: { type: String, default: '' },
    signatureImagePublicId: { type: String, default: null, select: false },
    /** CCCD/MST thuê bao VNPT SmartCA của cán bộ (tự gắn trên UI) */
    smartCaUserId: { type: String, default: '', trim: true },
    smartCaVerifiedAt: { type: Date, default: null },
    smartCaCertSubject: { type: String, default: '', trim: true },
    googleSub: { type: String, select: false, sparse: true, unique: true },
    googleEmail: { type: String, default: null },
    googlePicture: { type: String, default: '' },
    googleLinkedAt: { type: Date, default: null },
    dateOfBirth: { type: Date, default: null },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: null,
    },
    address: { type: String, trim: true, default: '' },
    role: { type: String, enum: ROLE_LIST, required: true, default: 'student' },
    permissions: [{ type: String }],
    isActive: { type: Boolean, default: true },
    /** Bắt đổi mật khẩu trước khi dùng hệ thống (tài khoản cấp mật khẩu mặc định). */
    mustChangePassword: { type: Boolean, default: false },
    refreshToken: { type: String, select: false },
    rememberSession: { type: Boolean, default: false, select: false },
    lastLoginAt: { type: Date },
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', default: null },
    boMonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoMon', default: null },
    lopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lop', default: null },
    sinhVienId: { type: mongoose.Schema.Types.ObjectId, ref: 'SinhVien', default: null },
    giangVienId: { type: mongoose.Schema.Types.ObjectId, ref: 'GiangVien', default: null },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });
userSchema.index({ role: 1, isActive: 1, createdAt: -1 });
userSchema.index({ isActive: 1, createdAt: -1 });

const User = mongoose.model('User', userSchema);
export default User;
