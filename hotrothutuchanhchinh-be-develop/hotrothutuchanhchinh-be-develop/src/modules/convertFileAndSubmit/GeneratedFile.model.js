import mongoose from 'mongoose';

const GeneratedFileSchema = new mongoose.Schema({
  tenDon: { type: String, required: true },
  tenNguoiGui: { type: String, required: true },
  duongDanFile: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workflowInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance' },
  currentStepOrder: { type: Number, default: 0 },
  trangThai: {
    type: String,
    enum: ['nhap', 'cho_duyet', 'da_duyet', 'tu_choi', 'tre_han', 'da_huy'],
    default: 'nhap',
  },
  /** Lý do sinh viên hủy đơn (khi trangThai = da_huy) */
  cancelReason: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  loaiDonId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoaiDon' },
  /** uploaded = SV nộp file đã điền; generated = hệ thống sinh từ form */
  sourceType: { type: String, enum: ['uploaded', 'generated'], default: 'uploaded' },
  originalFileName: String,
  fileMimeType: String,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('GeneratedFile', GeneratedFileSchema);
