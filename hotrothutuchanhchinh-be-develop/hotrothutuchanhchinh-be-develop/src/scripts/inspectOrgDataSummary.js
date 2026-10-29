import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import SinhVien from '../modules/organization/models/sinhVien.model.js';
import GiangVien from '../modules/organization/models/giangVien.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const [users, students, lecturers, svLinked, gvLinked] = await Promise.all([
    User.countDocuments({ isActive: true }),
    SinhVien.countDocuments({ isActive: true }),
    GiangVien.countDocuments({ isActive: true }),
    SinhVien.countDocuments({ isActive: true, userId: { $exists: true, $ne: null } }),
    GiangVien.countDocuments({ isActive: true, userId: { $exists: true, $ne: null } }),
  ]);

  const byRole = await User.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$role', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  const sampleStudents = await SinhVien.find({ isActive: true })
    .select('maSV fullName email userId')
    .limit(5)
    .lean();
  const sampleLecturers = await GiangVien.find({ isActive: true })
    .select('maGV fullName email userId')
    .limit(5)
    .lean();

  console.log(
    JSON.stringify(
      {
        summary: { users, students, lecturers, svLinked, gvLinked },
        usersByRole: byRole,
        sampleStudents,
        sampleLecturers,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
