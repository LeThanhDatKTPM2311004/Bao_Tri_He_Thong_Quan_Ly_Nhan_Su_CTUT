/**
 * Chỉ giữ 1 tài khoản SV: nthoahttt2211016@student.ctuet.edu.vn
 * Xóa các SV khác + dữ liệu liên quan (đơn, workflow, thông báo, chữ ký, hồ sơ SV…).
 */
import 'dotenv/config';
import mongoose from 'mongoose';

const KEEP_EMAIL = 'nthoahttt2211016@student.ctuet.edu.vn';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const keepUser = await db.collection('users').findOne({
    email: KEEP_EMAIL,
    role: 'student',
  });
  if (!keepUser) {
    throw new Error(`Không tìm thấy SV giữ lại: ${KEEP_EMAIL}`);
  }
  const keepId = keepUser._id;
  console.log('[Keep]', {
    _id: String(keepId),
    fullName: keepUser.fullName,
    studentId: keepUser.studentId,
    email: keepUser.email,
    sinhVienId: keepUser.sinhVienId ? String(keepUser.sinhVienId) : null,
  });

  const others = await db
    .collection('users')
    .find({ role: 'student', _id: { $ne: keepId } })
    .project({ email: 1, studentId: 1, fullName: 1, sinhVienId: 1 })
    .toArray();

  console.log(`[Delete] ${others.length} tài khoản SV khác:`);
  for (const u of others) {
    console.log(`  - ${u.studentId || '?'} | ${u.fullName} | ${u.email}`);
  }

  if (others.length === 0) {
    console.log('Không có SV nào khác để xóa.');
    await mongoose.disconnect();
    return;
  }

  const otherIds = others.map((u) => u._id);
  const otherEmails = others.map((u) => u.email).filter(Boolean);
  const otherStudentIds = others.map((u) => u.studentId).filter(Boolean);
  const otherSinhVienIds = others.map((u) => u.sinhVienId).filter(Boolean);

  const summary = {};

  // 1) GeneratedFile / submissions của SV bị xóa
  for (const col of ['generatedfiles', 'generatedFiles', 'GeneratedFile']) {
    try {
      const r = await db.collection(col).deleteMany({ submittedBy: { $in: otherIds } });
      if (r.deletedCount) summary[col] = (summary[col] || 0) + r.deletedCount;
    } catch {
      /* collection may not exist */
    }
  }

  // 2) WorkflowInstance
  for (const col of ['workflowinstances', 'workflowInstances']) {
    try {
      const r = await db.collection(col).deleteMany({ submittedBy: { $in: otherIds } });
      if (r.deletedCount) summary[col] = (summary[col] || 0) + r.deletedCount;
    } catch {
      /* ignore */
    }
  }

  // 3) Notifications gửi tới SV bị xóa
  for (const col of ['notifications']) {
    const r = await db.collection(col).deleteMany({ recipientId: { $in: otherIds } });
    if (r.deletedCount) summary[col] = r.deletedCount;
  }

  // 4) Signatures của SV bị xóa
  for (const col of ['signatures']) {
    const r = await db.collection(col).deleteMany({
      $or: [{ userId: { $in: otherIds } }, { user: { $in: otherIds } }],
    });
    if (r.deletedCount) summary[col] = r.deletedCount;
  }

  // 5) Password reset tokens
  for (const col of ['passwordresets', 'passwordResets']) {
    try {
      const r = await db.collection(col).deleteMany({
        $or: [{ userId: { $in: otherIds } }, { email: { $in: otherEmails } }],
      });
      if (r.deletedCount) summary[col] = (summary[col] || 0) + r.deletedCount;
    } catch {
      /* ignore */
    }
  }

  // 6) Audit logs liên quan user bị xóa
  for (const col of ['auditlogs', 'auditLogs']) {
    try {
      const r = await db.collection(col).deleteMany({
        $or: [
          { userId: { $in: otherIds } },
          { actorId: { $in: otherIds } },
          { 'meta.userId': { $in: otherIds } },
        ],
      });
      if (r.deletedCount) summary[col] = (summary[col] || 0) + r.deletedCount;
    } catch {
      /* ignore */
    }
  }

  // 7) Hồ sơ organization.sinhviens (không đụng hồ sơ của keep user)
  const sinhVienFilter = {
    $and: [
      {
        $or: [
          { userId: { $in: otherIds } },
          ...(otherSinhVienIds.length ? [{ _id: { $in: otherSinhVienIds } }] : []),
          ...(otherEmails.length ? [{ email: { $in: otherEmails } }] : []),
          ...(otherStudentIds.length ? [{ maSV: { $in: otherStudentIds } }] : []),
        ],
      },
      // không xóa hồ sơ gắn với tài khoản giữ lại
      { userId: { $ne: keepId } },
      ...(keepUser.sinhVienId ? [{ _id: { $ne: keepUser.sinhVienId } }] : []),
      ...(keepUser.email ? [{ email: { $ne: keepUser.email } }] : []),
      ...(keepUser.studentId ? [{ maSV: { $ne: keepUser.studentId } }] : []),
    ],
  };

  for (const col of ['sinhviens', 'sinhvien']) {
    try {
      const r = await db.collection(col).deleteMany(sinhVienFilter);
      if (r.deletedCount) summary[col] = (summary[col] || 0) + r.deletedCount;
    } catch {
      /* ignore */
    }
  }

  // 8) Files upload gắn user
  for (const col of ['files']) {
    try {
      const r = await db.collection(col).deleteMany({
        $or: [
          { uploadedBy: { $in: otherIds } },
          { userId: { $in: otherIds } },
          { ownerId: { $in: otherIds } },
        ],
      });
      if (r.deletedCount) summary[col] = r.deletedCount;
    } catch {
      /* ignore */
    }
  }

  // 9) Xóa User SV khác
  const userDel = await db.collection('users').deleteMany({
    role: 'student',
    _id: { $in: otherIds },
  });
  summary.users = userDel.deletedCount;

  // Verify
  const remainingStudents = await db.collection('users').countDocuments({ role: 'student' });
  const remainingEmails = await db
    .collection('users')
    .find({ role: 'student' })
    .project({ email: 1, studentId: 1, fullName: 1 })
    .toArray();

  console.log('\n[Summary] Đã xóa:');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\n[Verify] Còn ${remainingStudents} SV:`);
  for (const u of remainingEmails) {
    console.log(`  - ${u.studentId} | ${u.fullName} | ${u.email}`);
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[Fail]', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
