import 'dotenv/config';
import mongoose from 'mongoose';
import config from '../config/index.js';
import { cleanupRedundantCollections } from './cleanupRedundantCollections.js';

const run = async () => {
  try {
    mongoose.set('strictQuery', true);
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
    await mongoose.connect(config.mongoUri);
    console.log('[Database] Connected for cleanup');
    await cleanupRedundantCollections();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Cleanup] Failed:', error.message);
    process.exit(1);
  }
};

run();
