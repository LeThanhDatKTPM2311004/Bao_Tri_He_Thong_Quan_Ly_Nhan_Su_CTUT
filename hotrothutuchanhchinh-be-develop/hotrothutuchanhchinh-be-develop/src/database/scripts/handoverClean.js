/**
 * Clean dữ liệu bàn giao an toàn:
 * - Xóa toàn bộ dữ liệu nghiệp vụ / demo (org, SV, GV, đơn, workflow, …)
 * - Giữ / tạo lại 1 tài khoản Admin
 * - Seed lại danh mục Quyền chuẩn (QUYEN_CATALOG)
 *
 * KHÔNG chạy tự động. Chỉ chạy khi bạn chủ động gọi:
 *   npm run db:handover-clean -- --confirm
 *
 * Tuỳ chọn:
 *   --admin-email=...
 *   --admin-password=...
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import Quyen, { QUYEN_CATALOG } from '../../modules/organization/models/quyen.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES } from '../../config/roles.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '../../generated-files');

const DEFAULT_ADMIN_EMAIL = process.env.HANDOVER_ADMIN_EMAIL || 'admin@ctut.edu.vn';
const DEFAULT_ADMIN_PASSWORD = process.env.HANDOVER_ADMIN_PASSWORD || 'Admin@123';

/** Collection nghiệp vụ — drop hẳn (không để collection rỗng). */
const COLLECTIONS_TO_DROP = [
  // Tổ chức / người
  'sinhviens',
  'giangviens',
  'giangvienquyens',
  'lops',
  'bomons',
  'khoas',
  'quyens',
  // Hồ sơ / quy trình
  'passwordresets',
  'auditlogs',
  'formtemplates',
  'notifications',
  'signatures',
  'submissions',
  'workflowinstances',
  'workflows',
  'files',
  'documents',
  'generatedfiles',
  'loaidons',
  // Cấu hình runtime (để khách tự nhập lại nếu cần)
  'settings',
];

const parseArgs = (argv) => {
  const flags = new Set();
  const opts = {};
  for (const raw of argv) {
    if (raw === '--confirm' || raw === '-y') {
      flags.add('confirm');
      continue;
    }
    const m = raw.match(/^--([^=]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return { flags, opts };
};

const dropCollectionIfExists = async (db, name) => {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) return false;
  await db.dropCollection(name);
  console.log(`[HandoverClean] Dropped: ${name}`);
  return true;
};

const cleanGeneratedFilesDir = () => {
  if (!fs.existsSync(GENERATED_DIR)) return 0;
  let removed = 0;
  for (const file of fs.readdirSync(GENERATED_DIR)) {
    const full = path.join(GENERATED_DIR, file);
    try {
      if (fs.statSync(full).isFile()) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // bỏ qua file đang khóa
    }
  }
  return removed;
};

const seedQuyensOnly = async () => {
  for (const q of QUYEN_CATALOG) {
    await Quyen.findOneAndUpdate(
      { code: q.code },
      { ...q, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  await Quyen.updateMany({ group: 'ban_lanh_dao' }, { $set: { group: 'ban_giam_hieu' } });
  return QUYEN_CATALOG.length;
};

const ensureAdmin = async (email, password) => {
  const hashed = await hashPassword(password);
  const admin = await User.findOneAndUpdate(
    { email },
    {
      email,
      password: hashed,
      fullName: 'Quản trị viên Hệ thống',
      role: ROLES.ADMIN,
      department: 'Phòng Quản trị hệ thống',
      isActive: true,
      // gỡ liên kết org nếu còn sót field
      khoaId: null,
      boMonId: null,
      lopId: null,
      sinhVienId: null,
      giangVienId: null,
      studentId: null,
      faculty: '',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
  return admin;
};

const run = async () => {
  const { flags, opts } = parseArgs(process.argv.slice(2));

  if (!flags.has('confirm')) {
    console.error(`[HandoverClean] Từ chối chạy — thiếu cờ xác nhận.

Script này XÓA hầu hết dữ liệu DB (giữ Admin + seed lại Quyền).

Cách chạy an toàn:
  npm run db:handover-clean -- --confirm

Tuỳ chọn:
  npm run db:handover-clean -- --confirm --admin-email=admin@ctut.edu.vn --admin-password=MatKhauMoi
`);
    process.exit(1);
  }

  const adminEmail = String(opts['admin-email'] || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const adminPassword = String(opts['admin-password'] || DEFAULT_ADMIN_PASSWORD);

  try {
    await connectDatabase();
    const db = mongoose.connection.db;

    console.log('[HandoverClean] Bắt đầu clean bàn giao...');
    console.log(`[HandoverClean] Admin sẽ là: ${adminEmail}\n`);

    for (const name of COLLECTIONS_TO_DROP) {
      await dropCollectionIfExists(db, name);
    }

    // Xóa mọi user (kể cả admin cũ) rồi tạo lại admin sạch
    const removedUsers = await User.deleteMany({});
    console.log(`[HandoverClean] Cleared users: ${removedUsers.deletedCount}`);

    const admin = await ensureAdmin(adminEmail, adminPassword);
    console.log(`[HandoverClean] Admin ready: ${admin.email}`);

    const quyenCount = await seedQuyensOnly();
    console.log(`[HandoverClean] Seeded quyens: ${quyenCount}`);

    const removedFiles = cleanGeneratedFilesDir();
    if (removedFiles > 0) {
      console.log(`[HandoverClean] Removed generated files: ${removedFiles}`);
    }

    const remaining = await db.listCollections().toArray();
    console.log('\n[HandoverClean] Collections còn lại:');
    for (const c of remaining.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count}`);
    }

    console.log('\n[HandoverClean] Xong.');
    console.log(`[HandoverClean] Đăng nhập: ${adminEmail} / (mật khẩu đã đặt)`);
    console.log('[HandoverClean] Nên đổi mật khẩu admin ngay khi bàn giao.');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[HandoverClean] Failed:', error.message);
    process.exit(1);
  }
};

run();
