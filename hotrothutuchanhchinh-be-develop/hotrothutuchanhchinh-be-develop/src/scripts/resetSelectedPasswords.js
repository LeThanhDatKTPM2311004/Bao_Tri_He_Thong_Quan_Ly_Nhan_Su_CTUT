import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import { hashPassword } from '../shared/utils/hashPassword.js';

const TARGET_EMAILS = [
  'nthoa1082002@gmail.com',
  'mailanh1082002@gmail.com',
  'mailanh21082002@gmail.com',
];

const NEW_PASSWORD = '123456';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const hashed = await hashPassword(NEW_PASSWORD);
  const result = await User.updateMany(
    { email: { $in: TARGET_EMAILS } },
    {
      $set: {
        password: hashed,
        refreshToken: null,
        rememberSession: false,
      },
    },
  );

  const users = await User.find({ email: { $in: TARGET_EMAILS } })
    .select('fullName email role')
    .lean();

  console.log(JSON.stringify({
    matched: result.matchedCount,
    modified: result.modifiedCount,
    password: NEW_PASSWORD,
    users,
  }, null, 2));

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
