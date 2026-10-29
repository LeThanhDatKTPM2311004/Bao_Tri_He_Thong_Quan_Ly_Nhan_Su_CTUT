import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import { seedUsers } from '../seeders/userSeeder.js';

const run = async () => {
  await connectDatabase();

  try {
    await User.collection.dropIndex('googleSub_1');
    console.log('Dropped googleSub_1');
  } catch (err) {
    console.log('dropIndex:', err.message);
  }

  const unsetRes = await User.updateMany(
    { $or: [{ googleSub: null }, { googleSub: { $exists: true, $eq: null } }] },
    { $unset: { googleSub: '' } },
  );
  console.log('Unset null googleSub:', unsetRes.modifiedCount);

  await User.syncIndexes();
  console.log('Synced indexes');

  await seedUsers();

  const emails = await User.find({}, 'email role').sort({ email: 1 });
  console.log('Current users:');
  for (const user of emails) {
    console.log(` - ${user.email} (${user.role})`);
  }

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
