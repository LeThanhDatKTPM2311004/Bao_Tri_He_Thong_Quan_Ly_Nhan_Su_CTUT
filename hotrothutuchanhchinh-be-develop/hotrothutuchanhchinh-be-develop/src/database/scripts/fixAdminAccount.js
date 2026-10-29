import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES } from '../../config/roles.js';

const ADMIN_EMAIL = 'admin@student.ctuet.edu.vn';
const ADMIN_PASSWORD = 'Admin@123';
const LEGACY_ADMIN_EMAILS = ['admin@tthc.local', 'admin@tthc.edu.vn', 'admin@ctut.edu.vn'];

const run = async () => {
  try {
    await connectDatabase();

    for (const legacyEmail of LEGACY_ADMIN_EMAILS) {
      const legacy = await User.findOne({ email: legacyEmail });
      if (!legacy) continue;

      const targetExists = await User.findOne({ email: ADMIN_EMAIL });
      if (targetExists && String(targetExists._id) !== String(legacy._id)) {
        await User.deleteOne({ _id: legacy._id });
        console.log(`[FixAdmin] Removed duplicate legacy admin: ${legacyEmail}`);
      } else {
        legacy.email = ADMIN_EMAIL;
        legacy.fullName = 'Quản trị viên Hệ thống';
        legacy.role = ROLES.ADMIN;
        legacy.isActive = true;
        legacy.password = await hashPassword(ADMIN_PASSWORD);
        await legacy.save();
        console.log(`[FixAdmin] Migrated legacy admin: ${legacyEmail} → ${ADMIN_EMAIL}`);
      }
    }

    let admin = await User.findOne({ email: ADMIN_EMAIL });

    if (!admin) {
      admin = await User.create({
        email: ADMIN_EMAIL,
        password: await hashPassword(ADMIN_PASSWORD),
        fullName: 'Quản trị viên Hệ thống',
        role: ROLES.ADMIN,
        department: 'Phòng Quản trị hệ thống',
        isActive: true,
      });
      console.log(`[FixAdmin] Created admin: ${ADMIN_EMAIL}`);
    } else {
      admin.fullName = 'Quản trị viên Hệ thống';
      admin.role = ROLES.ADMIN;
      admin.isActive = true;
      admin.password = await hashPassword(ADMIN_PASSWORD);
      await admin.save();
      console.log(`[FixAdmin] Updated admin: ${ADMIN_EMAIL}`);
    }

    console.log(`[FixAdmin] Login with: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[FixAdmin] Failed:', error.message);
    process.exit(1);
  }
};

run();
