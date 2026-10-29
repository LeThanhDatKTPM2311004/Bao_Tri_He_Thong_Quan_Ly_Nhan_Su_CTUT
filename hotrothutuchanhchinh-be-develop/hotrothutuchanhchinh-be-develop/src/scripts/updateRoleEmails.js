import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';

const ROLE_EMAIL_UPDATES = [
  { role: 'principal', email: 'nthoa1082002@gmail.com', fullName: 'Nguyễn Trọng Hòa' },
  { role: 'principal', email: 'principal.ctut@gmail.com', fullName: 'GS. TS. Phạm Hoàng Hải' },
  { role: 'vice_principal', email: 'phohieu.ctut@gmail.com' },
  { role: 'department_head', email: 'truongphong.ctut@gmail.com' },
  { role: 'deputy_department_head', email: 'phophong.ctut@gmail.com' },
  { role: 'faculty_manager', email: 'mailanh1082002@gmail.com', fullName: 'PGS. TS. Nguyễn Văn Hùng' },
  { role: 'faculty_manager', email: 'manager.ctut@gmail.com', fullName: 'PGS.TS. Nguyễn Văn Hùng' },
  { role: 'deputy_faculty_manager', email: 'photruongkhoa.ctut@gmail.com' },
  { role: 'department_chair', email: 'truongbomon.ctut@gmail.com' },
  { role: 'department_chair', email: 'assistant.ctut@gmail.com', fullName: 'Lê Thanh Hương' },
  { role: 'deputy_department_chair', email: 'photruongbomon.ctut@gmail.com' },
  { role: 'academic_advisor', email: 'mailanh21082002@gmail.com' },
  { role: 'student_affairs', email: 'ctsv.ctut@gmail.com' },
  { role: 'office_staff', email: 'staff.ctut@gmail.com' },
  { role: 'admin', email: 'admin.ctut@gmail.com' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  for (const item of ROLE_EMAIL_UPDATES) {
    const query = item.fullName
      ? { role: item.role, fullName: item.fullName }
      : { role: item.role };
    const target = await User.findOne(query).sort({ createdAt: 1 });
    if (!target) continue;

    const conflict = await User.findOne({ email: item.email, _id: { $ne: target._id } });
    if (conflict) {
      console.log(`[SKIP] ${item.role} / ${item.fullName || target.fullName} -> ${item.email} (đang bị dùng bởi ${conflict.fullName})`);
      continue;
    }

    target.email = item.email;
    target.googleEmail = item.email;
    await target.save();
    console.log(`[OK] ${target.role} / ${target.fullName} -> ${item.email}`);
  }

  const users = await User.find({ role: { $ne: 'student' } })
    .select('fullName email role')
    .sort({ role: 1, createdAt: 1 })
    .lean();
  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
