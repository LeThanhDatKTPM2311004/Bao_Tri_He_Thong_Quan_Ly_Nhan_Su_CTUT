import mongoose from 'mongoose';

const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    accountEmail: { type: String, required: true, lowercase: true, trim: true },
    recipientEmail: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

passwordResetSchema.index({ tokenHash: 1 });
passwordResetSchema.index({ accountEmail: 1, createdAt: -1 });
passwordResetSchema.index({ userId: 1, createdAt: -1 });
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;
