import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../modules/users/user.model.js';
import { isValidCtutEmail } from '../shared/validators/ctutEmail.js';

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const students = await User.find({ role: 'student' }).select(
    'email googleEmail googleLinkedAt +googleSub',
  );

  let cleared = 0;
  for (const user of students) {
    const googleEmail = user.googleEmail || '';
    const shouldClear =
      user.googleSub &&
      (!isValidCtutEmail(googleEmail) || googleEmail !== user.email);

    if (!shouldClear) continue;

    await User.findByIdAndUpdate(user._id, {
      $unset: { googleSub: 1 },
      $set: {
        googleEmail: null,
        googlePicture: '',
        googleLinkedAt: null,
      },
    });
    cleared += 1;
    console.log(`[clear] ${user.email}`);
  }

  console.log(`Cleared invalid Google links for ${cleared} student account(s).`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
