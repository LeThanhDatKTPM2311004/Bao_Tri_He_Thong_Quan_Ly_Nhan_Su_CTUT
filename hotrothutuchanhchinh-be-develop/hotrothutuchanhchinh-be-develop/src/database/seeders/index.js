import 'dotenv/config';
import { connectDatabase } from '../../config/database.js';
import { seedUsers } from './userSeeder.js';
import { seedOrganization } from './organizationSeeder.js';

const runSeeders = async () => {
  try {
    await connectDatabase();
    console.log('[Seeder] Starting...');

    await seedOrganization();
    await seedUsers();

    console.log('[Seeder] Completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('[Seeder] Failed:', error.message);
    process.exit(1);
  }
};

runSeeders();
