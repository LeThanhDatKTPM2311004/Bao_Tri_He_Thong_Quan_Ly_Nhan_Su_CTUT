/**
 * Xóa hoàn toàn bộ môn KCCT (Kết cấu công trình) đang gắn dưới Khoa CNTT
 * cùng lớp / SV / GV / quyền GV / user liên quan.
 *
 * Chạy: node src/database/scripts/deleteKcctUnderCntt.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';

const run = async () => {
  await connectDatabase();
  const db = mongoose.connection.db;

  const khoaCntt = await db.collection('khoas').findOne({ code: 'CNTT' });
  if (!khoaCntt) {
    console.log('[DeleteKCCT] Không tìm thấy Khoa CNTT');
    await mongoose.disconnect();
    process.exit(0);
  }

  const boMon = await db.collection('bomons').findOne({
    code: 'KCCT',
    khoaId: khoaCntt._id,
  });

  if (!boMon) {
    console.log('[DeleteKCCT] Không còn bộ môn KCCT dưới Khoa CNTT');
    await mongoose.disconnect();
    process.exit(0);
  }

  const boMonId = boMon._id;
  const lops = await db.collection('lops').find({
    $or: [{ boMonId }, { code: /^KCCT/i }],
  }).toArray();
  const lopIds = lops.map((l) => l._id);

  const sinhviens = await db.collection('sinhviens').find({
    $or: [{ lopId: { $in: lopIds } }, { boMonId }],
  }).toArray();
  const svIds = sinhviens.map((s) => s._id);

  const gvs = await db.collection('giangviens').find({ boMonId }).toArray();
  const gvIds = gvs.map((g) => g._id);

  const userFilter = {
    $or: [
      { sinhVienId: { $in: svIds } },
      { giangVienId: { $in: gvIds } },
      { boMonId },
      { lopId: { $in: lopIds } },
    ],
  };

  console.log('[DeleteKCCT] Mục tiêu:');
  console.log(`  Bộ môn: ${boMon.code} — ${boMon.name}`);
  console.log(`  Lớp: ${lops.length}`);
  console.log(`  Sinh viên: ${sinhviens.length}`);
  console.log(`  Giảng viên: ${gvs.length}`);

  const gvQuyen = await db.collection('giangvienquyens').deleteMany({
    giangVienId: { $in: gvIds },
  });
  const delSv = await db.collection('sinhviens').deleteMany({ _id: { $in: svIds } });
  const delGv = await db.collection('giangviens').deleteMany({ _id: { $in: gvIds } });
  const delLop = await db.collection('lops').deleteMany({ _id: { $in: lopIds } });
  const delUsers = await db.collection('users').deleteMany({
    $and: [userFilter, { role: { $ne: 'admin' } }],
  });
  await db.collection('users').updateMany(
    { boMonId },
    { $set: { boMonId: null, lopId: null, sinhVienId: null, giangVienId: null } },
  );
  const delBm = await db.collection('bomons').deleteOne({ _id: boMonId });

  console.log('[DeleteKCCT] Đã xóa:');
  console.log(`  giangvienquyens: ${gvQuyen.deletedCount}`);
  console.log(`  sinhviens: ${delSv.deletedCount}`);
  console.log(`  giangviens: ${delGv.deletedCount}`);
  console.log(`  lops: ${delLop.deletedCount}`);
  console.log(`  users: ${delUsers.deletedCount}`);
  console.log(`  bomons: ${delBm.deletedCount}`);

  const left = await db.collection('bomons').find({ code: 'KCCT' }).toArray();
  const underCntt = await db.collection('bomons').find({ khoaId: khoaCntt._id }).toArray();
  console.log(`[DeleteKCCT] Còn KCCT trong DB: ${left.length}`);
  console.log(
    '[DeleteKCCT] Bộ môn còn dưới CNTT:',
    underCntt.map((b) => `${b.code} (${b.name})`).join(', ') || '(không còn)',
  );

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[DeleteKCCT] Failed:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
