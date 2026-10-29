/**
 * Xóa toàn bộ đơn đã nộp / hồ sơ GeneratedFile + workflow instance liên quan.
 * Giữ nguyên: users, khoa/lớp/SV, workflow định nghĩa, loại đơn, settings.
 *
 *   node scripts/clearSubmittedForms.mjs --confirm
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.argv.includes('--confirm')) {
  console.error('Thêm --confirm để xác nhận xóa toàn bộ đơn đã nộp.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const countsBefore = {
  generatedfiles: await db.collection('generatedfiles').countDocuments(),
  workflowinstances: await db.collection('workflowinstances').countDocuments(),
  signatures: await db.collection('signatures').countDocuments().catch(() => 0),
  notifications: await db.collection('notifications').countDocuments(),
};
console.log('Before:', countsBefore);

const fileIds = (
  await db.collection('generatedfiles').find({}).project({ _id: 1 }).toArray()
).map((d) => d._id);

const delFiles = await db.collection('generatedfiles').deleteMany({});
const delInstances = await db.collection('workflowinstances').deleteMany({});

let delSignatures = { deletedCount: 0 };
try {
  delSignatures = await db.collection('signatures').deleteMany({});
} catch {
  // collection may not exist
}

// Thông báo liên quan hồ sơ / ký / nộp đơn
const delNotis = await db.collection('notifications').deleteMany({
  $or: [
    { entityType: 'GeneratedFile' },
    { entityType: { $in: ['GeneratedFile', 'generatedfile', 'WorkflowInstance'] } },
    {
      type: {
        $in: [
          'signature_required',
          'submission_in_progress',
          'submission_approved',
          'submission_rejected',
          'submission_cancelled',
          'submission_overdue',
          'workflow_step',
        ],
      },
    },
    ...(fileIds.length
      ? [{ entityId: { $in: fileIds } }, { 'meta.fileId': { $in: fileIds } }]
      : []),
  ],
});

// submissions legacy nếu có
let delSubmissions = { deletedCount: 0 };
try {
  delSubmissions = await db.collection('submissions').deleteMany({});
} catch {
  //
}

console.log('Deleted:', {
  generatedfiles: delFiles.deletedCount,
  workflowinstances: delInstances.deletedCount,
  signatures: delSignatures.deletedCount,
  notifications: delNotis.deletedCount,
  submissions: delSubmissions.deletedCount,
});

console.log('After:', {
  generatedfiles: await db.collection('generatedfiles').countDocuments(),
  workflowinstances: await db.collection('workflowinstances').countDocuments(),
  notifications: await db.collection('notifications').countDocuments(),
});

await mongoose.disconnect();
console.log('Done.');
