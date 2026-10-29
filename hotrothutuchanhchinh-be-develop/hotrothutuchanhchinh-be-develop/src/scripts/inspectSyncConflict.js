import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import SinhVien from '../modules/organization/models/sinhVien.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const sv = await SinhVien.findOne({ maSV: 'HTTT2211016' }).lean();
  const byStudentId = await User.findOne({ studentId: 'HTTT2211016' }).lean();
  const byEmail = sv?.email
    ? await User.findOne({ email: String(sv.email).trim().toLowerCase() }).lean()
    : null;

  console.log(JSON.stringify({ sv, byStudentId, byEmail }, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
