import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: [
        'submission_created',
        'submission_approved',
        'submission_rejected',
        'submission_returned',
        'submission_cancelled',
        'submission_in_progress',
        'signature_required',
        'deadline_warning',
        'system',
      ],
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    entityType: String,
    entityId: mongoose.Schema.Types.ObjectId,
    isRead: { type: Boolean, default: false },
    readAt: Date,
    channels: [{ type: String, enum: ['in_app', 'email'] }],
    emailSentAt: Date,
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, entityId: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
