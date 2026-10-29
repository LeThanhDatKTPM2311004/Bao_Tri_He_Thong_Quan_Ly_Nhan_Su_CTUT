import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    mimeType: String,
    size: Number,
    path: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entityType: { type: String, enum: ['submission', 'signature', 'profile'] },
    entityId: mongoose.Schema.Types.ObjectId,
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

fileSchema.index({ entityType: 1, entityId: 1 });

const File = mongoose.model('File', fileSchema);
export default File;
