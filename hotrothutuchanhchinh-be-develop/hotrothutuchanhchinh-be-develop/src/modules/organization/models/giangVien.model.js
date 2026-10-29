import mongoose from 'mongoose';
import {
  STANDARD_EMAIL_REGEX,
  STANDARD_EMAIL_MESSAGE,
} from '../../../shared/validators/ctutEmail.js';
import { PHONE_REGEX, PHONE_INVALID_MESSAGE } from '../../../shared/validators/phoneText.js';
import {
  ORG_CODE_REGEX,
  ORG_NAME_REGEX,
} from '../../../shared/validators/organizationText.js';

const giangVienSchema = new mongoose.Schema(
  {
    maGV: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 15,
      validate: {
        validator: (value) => ORG_CODE_REGEX.test(value),
        message: 'Mã GV không được chứa ký tự đặc biệt',
      },
    },
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
    email: {
      type: String,
      required: [true, 'Vui lòng nhập Email'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => STANDARD_EMAIL_REGEX.test(value),
        message: STANDARD_EMAIL_MESSAGE,
      },
    },
    phone: {
      type: String,
      default: '',
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
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', required: true },
    boMonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoMon', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

giangVienSchema.index({ khoaId: 1, boMonId: 1, isActive: 1 });
giangVienSchema.index({ fullName: 'text', maGV: 'text', email: 'text' });

const GiangVien = mongoose.model('GiangVien', giangVienSchema);
export default GiangVien;
