import mongoose from 'mongoose';

const signatureSchema = new mongoose.Schema(
  {
    generatedFileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'GeneratedFile',
      required: true,
      index: true,
    },
    workflowInstanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WorkflowInstance',
      default: null,
    },
    stepOrder: { type: Number, required: true },
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['smartca_vnpt', 'smartca_viettel', 'usb_token', 'handwritten'],
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'signed', 'failed', 'verified', 'superseded'],
      default: 'signed',
    },
    certSerial: { type: String, default: '' },
    certSubject: { type: String, default: '' },
    documentHash: { type: String, required: true },
    signatureValue: { type: String, required: true },
    signedFileUrl: { type: String, required: true },
    stampImageUrl: { type: String, default: '' },
    comment: { type: String, default: '' },
    signedAt: { type: Date, default: Date.now },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

signatureSchema.index({ generatedFileId: 1, stepOrder: 1 });

const Signature = mongoose.model('Signature', signatureSchema);
export default Signature;
