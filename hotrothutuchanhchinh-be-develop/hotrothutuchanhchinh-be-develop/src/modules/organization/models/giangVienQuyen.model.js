import mongoose from 'mongoose';

const giangVienQuyenSchema = new mongoose.Schema(
  {
    giangVienId: { type: mongoose.Schema.Types.ObjectId, ref: 'GiangVien', required: true },
    quyenId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quyen', required: true },
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', default: null },
    boMonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BoMon', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

giangVienQuyenSchema.index({ giangVienId: 1, quyenId: 1, khoaId: 1, boMonId: 1 });

const GiangVienQuyen = mongoose.model('GiangVienQuyen', giangVienQuyenSchema);
export default GiangVienQuyen;
