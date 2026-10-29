import mongoose from 'mongoose';
import config from './index.js';
import { createIndexes } from '../database/indexes/createIndexes.js';

export const connectDatabase = async () => {
  if (!config.mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  mongoose.set('strictQuery', true);
  // Chỉ tạo collection/index cho module đang dùng — tránh sinh collection trống khi import model
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);

  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 20_000,
  });
  await createIndexes();
  console.log('[Database] Connected to MongoDB Atlas');
};

export default mongoose;
