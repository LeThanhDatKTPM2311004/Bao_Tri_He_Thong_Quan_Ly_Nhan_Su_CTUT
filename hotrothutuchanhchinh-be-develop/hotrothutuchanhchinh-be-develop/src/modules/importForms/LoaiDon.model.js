import mongoose from 'mongoose';

const chatbotIndexSchema = new mongoose.Schema(
  {
    keywords: { type: [String], default: [] },
    purposeSnippet: { type: String, default: '' },
    fieldHints: { type: [String], default: [] },
    whoApproves: { type: [String], default: [] },
    needParentSignature: { type: Boolean, default: false },
    indexedAt: { type: Date, default: null },
    sourceHash: { type: String, default: '' },
  },
  { _id: false },
);

const LoaiDonSchema = new mongoose.Schema(
  {
    tenDon: { type: String, required: true },
    templateFile: { type: String, required: true },
    sourceType: { type: String, default: 'imported_word' },
    originalFileName: String,
    description: String,
    workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' },
    chiTiet: [
      {
        moTa: String,
        placeHolder: String,
      },
    ],
    /** Chỉ mục chatbot do server tự sinh — không cấu hình thủ công */
    chatbotIndex: { type: chatbotIndexSchema, default: undefined },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    /**
     * Điều kiện dùng đơn (tuỳ chọn). NVQS:
     * nvqs_before_grad | nvqs_after_grad
     * Nếu trống, API suy từ tên/file mẫu.
     */
    eligibility: { type: String, default: null },
  },
  { timestamps: true },
);

export default mongoose.model('LoaiDon', LoaiDonSchema);
