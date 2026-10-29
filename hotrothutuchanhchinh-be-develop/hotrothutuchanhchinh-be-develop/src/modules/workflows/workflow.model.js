import mongoose from 'mongoose';

const workflowStepSchema = new mongoose.Schema(
  {
    stepOrder: Number,
    stepName: String,
    role: String,
    /** Vai trò nguồn của chuyển tiếp (UI: combobox trái) */
    fromRole: { type: String, default: null },
    /**
     * Đơn vị / Phòng ban / Trung tâm gắn với bước (khớp User.department).
     * Bắt buộc với Trưởng/Phó phòng, Giám đốc/Phó GĐ trung tâm.
     */
    assigneeDepartment: { type: String, default: null, trim: true },
    action: { type: String, enum: ['review', 'approve', 'sign', 'forward'] },
    isRequired: { type: Boolean, default: true },
    allowReject: { type: Boolean, default: true },
    allowReturn: { type: Boolean, default: true },
    /** false = bước chỉ duyệt trên hệ thống, không đóng dấu PDF */
    allowSign: { type: Boolean, default: true },
    /** true = bắt buộc ký số hoặc ký tay mới được chuyển bước */
    requiresSignature: { type: Boolean, default: false },
    /** student = trả hồ sơ cho sinh viên; previous = trả về bước ngay trước */
    returnTo: { type: String, enum: ['student', 'previous'], default: 'student' },
    /** Số ngày tối đa để xử lý bước này (trống / 0 = không giới hạn) */
    deadlineDays: { type: Number, default: null, min: 0 },
    slaHours: Number,
  },
  { _id: false },
);

const workflowSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    loaiDonId: { type: mongoose.Schema.Types.ObjectId, ref: 'LoaiDon' },
    isDefault: { type: Boolean, default: false },
    steps: [workflowStepSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

workflowSchema.index({ loaiDonId: 1 }, { unique: true, sparse: true });

const workflowInstanceSchema = new mongoose.Schema(
  {
    generatedFileId: { type: mongoose.Schema.Types.ObjectId, ref: 'GeneratedFile', sparse: true },
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
    currentStepOrder: { type: Number, default: 1 },
    /** Thời điểm hồ sơ vào bước hiện tại — dùng tính hạn xử lý */
    currentStepEnteredAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'rejected', 'overdue', 'cancelled'],
      default: 'pending',
    },
    steps: [
      {
        stepOrder: Number,
        stepName: String,
        assignedRole: String,
        handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        action: String,
        comment: String,
        handledAt: Date,
        signatureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Signature', default: null },
      },
    ],
    startedAt: Date,
    completedAt: Date,
  },
  { timestamps: true },
);

export const Workflow = mongoose.model('Workflow', workflowSchema);
export const WorkflowInstance = mongoose.model('WorkflowInstance', workflowInstanceSchema);
