import Khoa from '../../modules/organization/models/khoa.model.js';
import BoMon from '../../modules/organization/models/boMon.model.js';
import Lop from '../../modules/organization/models/lop.model.js';
import Quyen, { QUYEN_CATALOG } from '../../modules/organization/models/quyen.model.js';
import { migrateAssistantInternalCodes } from '../scripts/migrateAssistantCodes.js';

export const seedOrganization = async () => {
  await migrateAssistantInternalCodes();

  for (const q of QUYEN_CATALOG) {
    await Quyen.findOneAndUpdate({ code: q.code }, { ...q, isActive: true }, { upsert: true });
  }

  // Đổi key nhóm cũ ban_lanh_dao → ban_giam_hieu
  await Quyen.updateMany({ group: 'ban_lanh_dao' }, { $set: { group: 'ban_giam_hieu' } });

  const khoaCnt = await Khoa.countDocuments();
  if (khoaCnt > 0) {
    console.log('[Seeder] Organization already exists, skipping demo data');
    return;
  }

  const cntt = await Khoa.create({
    code: 'CNTT',
    name: 'Khoa Công nghệ Thông tin',
    description: 'Khoa CNTT - CTUT',
  });

  const dvt = await Khoa.create({
    code: 'DVT',
    name: 'Khoa Điện tử Viễn thông',
    description: 'Khoa Điện tử Viễn thông - CTUT',
  });

  const khmt = await BoMon.create({
    code: 'KHMT',
    name: 'Bộ môn Khoa học Máy tính',
    khoaId: cntt._id,
  });

  const htvt = await BoMon.create({
    code: 'HTVT',
    name: 'Bộ môn Hệ thống Thông tin',
    khoaId: cntt._id,
  });

  await Lop.create({
    code: 'DH22TIN01',
    name: 'DH22TIN01',
    khoaId: cntt._id,
    boMonId: khmt._id,
    academicYear: '2022',
  });

  await Lop.create({
    code: 'DH22TIN02',
    name: 'DH22TIN02',
    khoaId: cntt._id,
    boMonId: htvt._id,
    academicYear: '2022',
  });

  console.log(`[Seeder] Organization demo data seeded (2 khoa, 2 bộ môn, 2 lớp, ${QUYEN_CATALOG.length} quyền)`);
};
