import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import GeneratedFile from '../modules/convertFileAndSubmit/GeneratedFile.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const student = await User.findOne({
    email: 'nthoahttt2211016@student.ctuet.edu.vn',
  }).select('email fullName studentId role _id').lean();

  const principal = await User.findOne({
    email: 'nthoa1082002@gmail.com',
  }).select('email fullName studentId role _id').lean();

  const latestFiles = await GeneratedFile.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('submittedBy', 'email fullName studentId role')
    .lean();

  console.log('STUDENT:', JSON.stringify(student, null, 2));
  console.log('PRINCIPAL:', JSON.stringify(principal, null, 2));
  console.log('LATEST FILES:', JSON.stringify(latestFiles, null, 2));

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
