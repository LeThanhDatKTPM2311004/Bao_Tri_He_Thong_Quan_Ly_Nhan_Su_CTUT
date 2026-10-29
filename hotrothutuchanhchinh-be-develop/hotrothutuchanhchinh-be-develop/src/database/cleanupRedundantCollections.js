import mongoose from 'mongoose';

/** Collections required for login + user management phase */
const KEEP_COLLECTIONS = new Set([
  'users',
  'passwordresets',
  'khoas',
  'bomons',
  'lops',
  'sinhviens',
  'giangviens',
  'quyens',
  'giangvienquyens',
]);

const REDUNDANT_COLLECTIONS = [
  'auditlogs',
  'formtemplates',
  'notifications',
  'signatures',
  'submissions',
  'workflowinstances',
  'workflows',
  'files',
  'documents',
];

export const cleanupRedundantCollections = async () => {
  const db = mongoose.connection.db;
  const existing = await db.listCollections().toArray();
  const existingNames = existing.map((c) => c.name);

  const toDrop = existingNames.filter(
    (name) => !KEEP_COLLECTIONS.has(name) && REDUNDANT_COLLECTIONS.includes(name),
  );

  if (toDrop.length === 0) {
    console.log('[Cleanup] No redundant collections to drop.');
    return { dropped: [], kept: existingNames };
  }

  for (const name of toDrop) {
    await db.dropCollection(name);
    console.log(`[Cleanup] Dropped collection: ${name}`);
  }

  const remaining = (await db.listCollections().toArray()).map((c) => c.name);
  console.log(`[Cleanup] Remaining collections: ${remaining.join(', ') || '(none)'}`);

  return { dropped: toDrop, kept: remaining };
};
