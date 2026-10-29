/**
 * Dọn workflow/generatedfile mồ côi sau khi xóa SV khác.
 * Không đụng workflow của cán bộ còn tồn tại.
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const KEEP_EMAIL = 'nthoahttt2211016@student.ctuet.edu.vn';

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const keep = await db.collection('users').findOne({ email: KEEP_EMAIL, role: 'student' });
if (!keep) throw new Error('Keep user not found');
const keepId = keep._id;

const existingUserIds = new Set(
  (await db.collection('users').find({}).project({ _id: 1 }).toArray()).map((u) => String(u._id)),
);

const allWi = await db
  .collection('workflowinstances')
  .find({})
  .project({ _id: 1, generatedFileId: 1, submittedBy: 1, status: 1 })
  .toArray();

const orphanWi = allWi.filter((w) => {
  if (!w.submittedBy) return true;
  const sid = String(w.submittedBy);
  if (sid === String(keepId)) return false;
  // submittedBy trỏ user đã bị xóa
  return !existingUserIds.has(sid);
});

console.log('Total WI:', allWi.length);
console.log('Orphan WI (null or deleted submitter):', orphanWi.length);

const orphanFileIds = orphanWi.map((w) => w.generatedFileId).filter(Boolean);
const orphanFiles = orphanFileIds.length
  ? await db
      .collection('generatedfiles')
      .find({ _id: { $in: orphanFileIds } })
      .project({ _id: 1, submittedBy: 1, tenDon: 1, tenNguoiGui: 1 })
      .toArray()
  : [];

const fileIdsToDelete = orphanFiles
  .filter((f) => {
    if (!f.submittedBy) return true;
    const sid = String(f.submittedBy);
    if (sid === String(keepId)) return false;
    return !existingUserIds.has(sid);
  })
  .map((f) => f._id);

console.log('Orphan generatedfiles:', fileIdsToDelete.length);

if (fileIdsToDelete.length) {
  const r = await db.collection('generatedfiles').deleteMany({ _id: { $in: fileIdsToDelete } });
  console.log('Deleted generatedfiles:', r.deletedCount);
}

if (orphanWi.length) {
  const r = await db
    .collection('workflowinstances')
    .deleteMany({ _id: { $in: orphanWi.map((w) => w._id) } });
  console.log('Deleted workflowinstances:', r.deletedCount);
}

// GeneratedFile của user đã xóa (không qua WI)
const orphanGfDirect = await db
  .collection('generatedfiles')
  .find({})
  .project({ _id: 1, submittedBy: 1 })
  .toArray();
const gfExtra = orphanGfDirect
  .filter((f) => {
    if (!f.submittedBy) return false; // có thể là bulk/system — bỏ qua nếu không chắc
    const sid = String(f.submittedBy);
    if (sid === String(keepId)) return false;
    return !existingUserIds.has(sid);
  })
  .map((f) => f._id);
if (gfExtra.length) {
  const r = await db.collection('generatedfiles').deleteMany({ _id: { $in: gfExtra } });
  console.log('Deleted extra orphan generatedfiles:', r.deletedCount);
}

const rNoti = await db.collection('notifications').deleteMany({
  recipientId: {
    $nin: [...existingUserIds].map((id) => new mongoose.Types.ObjectId(id)),
  },
});
console.log('Deleted orphan notifications:', rNoti.deletedCount);

console.log({
  students: await db.collection('users').countDocuments({ role: 'student' }),
  sinhviens: await db.collection('sinhviens').countDocuments(),
  workflowinstances: await db.collection('workflowinstances').countDocuments(),
  generatedfiles: await db.collection('generatedfiles').countDocuments(),
  keepFiles: await db.collection('generatedfiles').countDocuments({ submittedBy: keepId }),
});

await mongoose.disconnect();
