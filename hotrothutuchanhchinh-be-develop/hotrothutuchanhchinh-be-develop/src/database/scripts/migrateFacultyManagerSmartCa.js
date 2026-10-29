/**
 * Gán thuê bao SmartCA vào tài khoản Trưởng khoa CNTT.
 * Usage:
 *   node src/database/scripts/migrateFacultyManagerSmartCa.js 083187028029
 *   node src/database/scripts/migrateFacultyManagerSmartCa.js --id=083187028029
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../../modules/users/user.model.js';

const FACULTY_MANAGER_EMAIL = 'mailanh1082002@gmail.com';

const resolveSmartCaUserId = () => {
  const arg = process.argv.slice(2).find((a) => a && !a.startsWith('--'));
  const flag = process.argv.find((a) => a.startsWith('--id='));
  const fromFlag = flag ? flag.slice('--id='.length) : '';
  return String(fromFlag || arg || '')
    .trim()
    .replace(/[\s.-]/g, '');
};

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('Missing MONGO_URI');
  }

  const smartCaUserId = resolveSmartCaUserId();
  if (!smartCaUserId) {
    throw new Error(
      'Thiếu CCCD/MST. Ví dụ: npm run db:migrate-smartca-manager -- 083187028029',
    );
  }

  await mongoose.connect(uri);
  const user = await User.findOne({ email: FACULTY_MANAGER_EMAIL.toLowerCase() });
  if (!user) {
    throw new Error(`Không tìm thấy user ${FACULTY_MANAGER_EMAIL}`);
  }

  user.smartCaUserId = smartCaUserId;
  if (!user.smartCaVerifiedAt) {
    user.smartCaVerifiedAt = new Date();
  }
  if (!user.smartCaCertSubject) {
    user.smartCaCertSubject = `CN=${user.fullName}, E=${user.email}`;
  }
  await user.save();

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        smartCaUserId: user.smartCaUserId,
        smartCaVerifiedAt: user.smartCaVerifiedAt,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err.message || err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
