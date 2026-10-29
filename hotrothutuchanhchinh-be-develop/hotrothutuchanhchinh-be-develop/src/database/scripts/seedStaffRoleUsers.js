import 'dotenv/config';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import Khoa from '../../modules/organization/models/khoa.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';

const DEFAULT_PASSWORD = 'Pmtthc@123';

/** Một tài khoản mỗi vai trò (trừ admin, sinh viên, hiệu trưởng) */
const STAFF_ROLE_USERS = [
  {
    email: 'phohieu.ctut@gmail.com',
    fullName: 'PGS.TS. Lê Văn Phó',
    role: ROLES.VICE_PRINCIPAL,
    department: 'Ban Giám hiệu',
  },
  {
    email: 'truongphong.ctut@gmail.com',
    fullName: 'Nguyễn Thị Mai',
    role: ROLES.DEPARTMENT_HEAD,
    department: 'Phòng Đào tạo',
  },
  {
    email: 'phophong.ctut@gmail.com',
    fullName: 'Trần Văn Đức',
    role: ROLES.DEPUTY_DEPARTMENT_HEAD,
    department: 'Phòng Đào tạo',
  },
  {
    email: 'mailanh1082002@gmail.com',
    fullName: 'PGS.TS. Nguyễn Văn Hùng',
    role: ROLES.FACULTY_MANAGER,
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: 'photruongkhoa.ctut@gmail.com',
    fullName: 'TS. Phạm Minh Tuấn',
    role: ROLES.DEPUTY_FACULTY_MANAGER,
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: 'truongbomon.ctut@gmail.com',
    fullName: 'ThS. Lê Thanh Hương',
    role: ROLES.DEPARTMENT_CHAIR,
    department: 'Bộ môn Khoa học Máy tính',
  },
  {
    email: 'photruongbomon.ctut@gmail.com',
    fullName: 'ThS. Hoàng Văn Nam',
    role: ROLES.DEPUTY_DEPARTMENT_CHAIR,
    department: 'Bộ môn Khoa học Máy tính',
  },
  {
    email: 'mailanh21082002@gmail.com',
    fullName: 'ThS. Trần Quốc Bình',
    role: ROLES.ACADEMIC_ADVISOR,
    department: 'Bộ môn Khoa học Máy tính',
  },
  {
    email: 'troly.khoa.cntt@ctut.edu.vn',
    fullName: 'Trợ lý Khoa CNTT (demo)',
    role: ROLES.KHOA_ASSISTANT,
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: 'troly.phong.daotao@ctut.edu.vn',
    fullName: 'Trợ lý Phòng Đào tạo (demo)',
    role: ROLES.PHONG_ASSISTANT,
    department: 'Phòng Đào tạo',
  },
  {
    email: 'troly.trungtam@ctut.edu.vn',
    fullName: 'Trợ lý Trung tâm (demo)',
    role: ROLES.TRUNG_TAM_ASSISTANT,
    department: 'Trung tâm Công nghệ Thông tin',
  },
];

const run = async () => {
  await connectDatabase();
  const hashed = await hashPassword(DEFAULT_PASSWORD);

  let created = 0;
  let skipped = 0;

  console.log('\n=== Tài khoản vai trò cán bộ (mật khẩu: Pmtthc@123) ===\n');

  for (const userData of STAFF_ROLE_USERS) {
    const exists = await User.findOne({ email: userData.email });
    if (exists) {
      skipped++;
      console.log(`[SKIP] ${userData.email} — đã tồn tại (${ROLE_LABELS[exists.role]})`);
      continue;
    }

    await User.create({
      ...userData,
      password: hashed,
      isActive: true,
      ...(userData.role === ROLES.KHOA_ASSISTANT ||
      userData.role === ROLES.FACULTY_MANAGER ||
      userData.role === ROLES.DEPUTY_FACULTY_MANAGER
        ? {
            khoaId:
              (
                await Khoa.findOne({
                  name: {
                    $regex: `^${String(userData.faculty || 'Khoa Công nghệ thông tin').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
                    $options: 'i',
                  },
                }).select('_id')
              )?._id || null,
          }
        : {}),
    });
    created++;
    console.log(`[OK]   ${userData.email} — ${ROLE_LABELS[userData.role]}`);
  }

  console.log(`\nTạo mới: ${created}, bỏ qua: ${skipped}\n`);
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
