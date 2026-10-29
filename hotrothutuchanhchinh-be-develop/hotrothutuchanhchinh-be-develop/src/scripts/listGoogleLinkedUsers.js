import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({
    $or: [
      { googleSub: { $exists: true, $ne: null } },
      { googleEmail: { $exists: true, $ne: null } },
    ],
  })
    .select('fullName email role googleEmail googleLinkedAt +googleSub')
    .lean();

  console.log(JSON.stringify(users, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
