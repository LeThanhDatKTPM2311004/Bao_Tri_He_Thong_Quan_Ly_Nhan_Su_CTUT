import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES } from '../../config/roles.js';

const ADMIN_EMAIL = 'admin@student.ctuet.edu.vn';
const ADMIN_PASSWORD = 'Admin@123';

/** Xóa hẳn collection (không để lại collection rỗng trên Compass/Atlas). */
const COLLECTIONS_TO_DROP = [
  'sinhviens',
  'giangviens',
  'giangvienquyens',
  'lops',
  'bomons',
  'khoas',
  'quyens',
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
];

const dropCollectionIfExists = async (db, name) => {
  const exists = await db.listCollections({ name }).hasNext();
  if (!exists) return false;
  await db.dropCollection(name);
  console.log(`[Reset] Dropped collection: ${name}`);
  return true;
};

const run = async () => {
  try {
    await connectDatabase();
    const db = mongoose.connection.db;
    console.log('[Reset] Full clean — only admin user will remain...\n');

    for (const name of COLLECTIONS_TO_DROP) {
      await dropCollectionIfExists(db, name);
    }

    const removedUsers = await User.deleteMany({});
    console.log(`[Reset] Cleared users: ${removedUsers.deletedCount} document(s)`);

    await User.create({
      email: ADMIN_EMAIL,
      password: await hashPassword(ADMIN_PASSWORD),
      fullName: 'Quản trị viên Hệ thống',
      role: ROLES.ADMIN,
      department: 'Phòng Quản trị hệ thống',
      isActive: true,
    });
    console.log('[Reset] Created fresh admin account');

    const remaining = await db.listCollections().toArray();
    console.log('\n[Reset] Remaining collections:');
    for (const c of remaining.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(c.name).countDocuments();
      console.log(`  - ${c.name}: ${count} document(s)`);
    }

    console.log('\n[Reset] Done.');
    console.log(`[Reset] Login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Reset] Failed:', error.message);
    process.exit(1);
  }
};

run();
