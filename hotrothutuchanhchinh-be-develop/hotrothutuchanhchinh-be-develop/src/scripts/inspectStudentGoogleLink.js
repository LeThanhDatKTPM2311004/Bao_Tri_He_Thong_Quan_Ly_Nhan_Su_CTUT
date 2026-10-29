import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';

const TARGET_EMAIL = 'nthoahttt2211016@student.ctuet.edu.vn';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const matchedUsers = await User.find({
    $or: [{ email: TARGET_EMAIL }, { googleEmail: TARGET_EMAIL }],
  })
    .select('email fullName role googleEmail googleLinkedAt +googleSub')
    .lean();

  console.log(JSON.stringify(matchedUsers, null, 2));
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
