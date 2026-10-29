import mongoose from 'mongoose';
import {
  ACADEMIC_YEAR_REGEX,
  ORG_CODE_REGEX,
  ORG_NAME_REGEX,
} from '../../../shared/validators/organizationText.js';

const lopSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 100,
      validate: {
        validator: (value) => ORG_CODE_REGEX.test(value),
        message: 'Mã lớp không được chứa ký tự đặc biệt',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      validate: {
        validator: (value) => ORG_NAME_REGEX.test(value),
        message: 'Tên lớp không được chứa ký tự đặc biệt',
      },
    },
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', required: true },
    boMonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoMon', required: true },
    academicYear: {
      type: String,
      default: '',
      trim: true,
      validate: {
        validator(value) {
          if (!value) {
            return true;
          }
          return ACADEMIC_YEAR_REGEX.test(value);
        },
        message: 'Niên khóa chỉ được nhập 4 chữ số từ 0000 đến 9999',
      },
    },
    /** Cố vấn học tập của lớp */
    coVanId: { type: mongoose.Schema.Types.ObjectId, ref: 'GiangVien', default: null },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

lopSchema.index({ boMonId: 1, code: 1 }, { unique: true });
lopSchema.index({ khoaId: 1, boMonId: 1, isActive: 1 });

const Lop = mongoose.model('Lop', lopSchema);
export default Lop;
