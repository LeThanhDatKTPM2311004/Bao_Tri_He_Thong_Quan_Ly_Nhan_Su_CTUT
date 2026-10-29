import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';

const KEEP_COLLECTIONS = new Set(['users']);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_DIR = path.resolve(__dirname, '../../generated-files');

const cleanGeneratedFiles = () => {
  if (!fs.existsSync(GENERATED_DIR)) return 0;
  const files = fs.readdirSync(GENERATED_DIR);
  let removed = 0;
  for (const file of files) {
    const full = path.join(GENERATED_DIR, file);
    if (fs.statSync(full).isFile()) {
      fs.unlinkSync(full);
      removed++;
    }
  }
  return removed;
};

const run = async () => {
  await connectDatabase();
  const db = mongoose.connection.db;

  console.log('[Clean] Xóa dữ liệu — giữ lại collection users...\n');

  const collections = await db.listCollections().toArray();
  let dropped = 0;

  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    if (KEEP_COLLECTIONS.has(name)) {
      const count = await db.collection(name).countDocuments();
      console.log(`[Keep] ${name}: ${count} document(s)`);
      continue;
    }
    await db.dropCollection(name);
    console.log(`[Dropped] ${name}`);
    dropped++;
  }

  const fileCount = cleanGeneratedFiles();
  if (fileCount > 0) {
    console.log(`[Clean] Removed ${fileCount} generated file(s) on disk`);
  }

  const userCount = await User.countDocuments();
  console.log(`\n[Clean] Done. Dropped ${dropped} collection(s). Users remaining: ${userCount}`);

  await mongoose.disconnect();
  process.exit(0);
};

run().catch((err) => {
  console.error('[Clean] Failed:', err.message);
  process.exit(1);
});
