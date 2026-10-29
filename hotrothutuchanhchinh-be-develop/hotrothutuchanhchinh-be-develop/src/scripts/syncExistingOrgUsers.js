import 'dotenv/config';
import mongoose from 'mongoose';
import SinhVien from '../modules/organization/models/sinhVien.model.js';
import GiangVien from '../modules/organization/models/giangVien.model.js';
import {
  syncUserFromGiangVien,
  syncUserFromSinhVien,
} from '../modules/organization/orgUserSync.service.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  let studentCount = 0;
  let lecturerCount = 0;
  const errors = [];

  const sinhViens = await SinhVien.find({ isActive: true });
  for (const sv of sinhViens) {
    try {
      await syncUserFromSinhVien(sv);
      studentCount += 1;
    } catch (error) {
      errors.push({
        type: 'student',
        maSV: sv.maSV,
        email: sv.email,
        message: error.message,
      });
    }
  }

  const giangViens = await GiangVien.find({ isActive: true });
  for (const gv of giangViens) {
    try {
      await syncUserFromGiangVien(gv);
      lecturerCount += 1;
    } catch (error) {
      errors.push({
        type: 'lecturer',
        maGV: gv.maGV,
        email: gv.email,
        message: error.message,
      });
    }
  }

  console.log(`Synced ${studentCount} student account(s) and ${lecturerCount} lecturer account(s).`);
  if (errors.length > 0) {
    console.log(`Skipped ${errors.length} record(s) due to errors:`);
    console.log(JSON.stringify(errors, null, 2));
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
