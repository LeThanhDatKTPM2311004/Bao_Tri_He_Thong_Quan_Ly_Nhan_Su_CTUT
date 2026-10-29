import mongoose from 'mongoose';

export const setupTestDb = async () => {
  const uri = process.env.MONGO_URI_TEST || 'mongodb://localhost:27017/tthc_test';
  await mongoose.connect(uri);
};

export const teardownTestDb = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
};
