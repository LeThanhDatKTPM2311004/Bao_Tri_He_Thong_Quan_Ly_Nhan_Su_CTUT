import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import SinhVien from '../modules/organization/models/sinhVien.model.js';

const TARGET_EMAIL = 'nthoahttt2211016@student.ctuet.edu.vn';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({ email: TARGET_EMAIL })
    .select('fullName email role studentId googleEmail')
    .lean();

  const students = await SinhVien.find({ email: TARGET_EMAIL })
    .select('fullName email maSV userId')
    .lean();

  console.log(JSON.stringify({ users, students }, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
