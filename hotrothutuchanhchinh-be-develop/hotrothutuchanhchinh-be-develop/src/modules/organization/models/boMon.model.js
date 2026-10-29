import mongoose from 'mongoose';

const boMonSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    khoaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Khoa', required: true },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

boMonSchema.index({ khoaId: 1, code: 1 }, { unique: true });
boMonSchema.index({ khoaId: 1, isActive: 1, name: 1 });

const BoMon = mongoose.model('BoMon', boMonSchema);
export default BoMon;
