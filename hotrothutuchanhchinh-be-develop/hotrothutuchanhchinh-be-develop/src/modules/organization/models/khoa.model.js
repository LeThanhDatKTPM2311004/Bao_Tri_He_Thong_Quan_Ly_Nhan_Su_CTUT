import mongoose from 'mongoose';
import { KHOA_CODE_REGEX, KHOA_NAME_REGEX } from '../../../shared/validators/khoaText.js';

const khoaSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 15,
      validate: {
        validator: (value) => KHOA_CODE_REGEX.test(value),
        message: 'Mã khoa không được chứa ký tự đặc biệt',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      validate: {
        validator: (value) => KHOA_NAME_REGEX.test(value),
        message: 'Tên khoa không được chứa ký tự đặc biệt',
      },
    },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

khoaSchema.index({ isActive: 1, name: 1 });

const Khoa = mongoose.model('Khoa', khoaSchema);
export default Khoa;
