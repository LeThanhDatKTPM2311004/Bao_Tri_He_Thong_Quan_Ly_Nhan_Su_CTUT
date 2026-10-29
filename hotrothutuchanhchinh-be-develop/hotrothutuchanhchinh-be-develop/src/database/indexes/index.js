import { createIndexes } from './createIndexes.js';

export const runDatabaseSetup = async () => {
  await createIndexes();
  console.log('[Database] Indexes created');
};
