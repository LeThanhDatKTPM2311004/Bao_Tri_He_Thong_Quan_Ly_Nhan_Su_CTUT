import User from '../../modules/users/user.model.js';
import Khoa from '../../modules/organization/models/khoa.model.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import { ROLES } from '../../config/roles.js';

const ADVISOR_EMAIL = 'mailanh21082002@gmail.com';
const FACULTY_MANAGER_EMAIL = 'mailanh1082002@gmail.com';
const PRINCIPAL_EMAIL = 'nthoa1082002@gmail.com';
const DEPARTMENT_CHAIR_EMAIL = 'truongbomon.ctut@gmail.com';
const LEGACY_ASSISTANT_EMAIL = 'assistant.ctut@gmail.com';
const STUDENT_AFFAIRS_EMAIL = 'ctsv.ctut@gmail.com';
const OFFICE_STAFF_EMAIL = 'staff.ctut@gmail.com';
const ADMIN_EMAIL = 'admin@ctut.edu.vn';

const LEGACY_EMAIL_MAP = [
  ['sinhvien@tthc.edu.vn', 'sinhvien@student.ctuet.edu.vn'],
  ['advisor@tthc.edu.vn', ADVISOR_EMAIL],
  ['assistant@tthc.edu.vn', LEGACY_ASSISTANT_EMAIL],
  ['manager@tthc.edu.vn', FACULTY_MANAGER_EMAIL],
  ['ctsv@tthc.edu.vn', STUDENT_AFFAIRS_EMAIL],
  ['principal@tthc.edu.vn', PRINCIPAL_EMAIL],
  ['staff@tthc.edu.vn', OFFICE_STAFF_EMAIL],
  ['admin@tthc.local', ADMIN_EMAIL],
  // From previous @ctut.edu.vn / gmail convention
  ['sinhvien@ctut.edu.vn', 'sinhvien@student.ctuet.edu.vn'],
  ['advisor@ctut.edu.vn', ADVISOR_EMAIL],
  ['assistant@ctut.edu.vn', LEGACY_ASSISTANT_EMAIL],
  ['manager@ctut.edu.vn', FACULTY_MANAGER_EMAIL],
  ['ctsv@ctut.edu.vn', STUDENT_AFFAIRS_EMAIL],
  ['principal@ctut.edu.vn', PRINCIPAL_EMAIL],
  ['staff@ctut.edu.vn', OFFICE_STAFF_EMAIL],
  ['admin.ctut@gmail.com', ADMIN_EMAIL],
];

const DEMO_USERS = [
  {
    email: 'sinhvien@student.ctuet.edu.vn',
    password: 'Student@123',
    fullName: 'Nguyễn Văn An',
    role: ROLES.STUDENT,
    studentId: 'SV20260001',
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: ADVISOR_EMAIL,
    password: 'Advisor@123',
    fullName: 'ThS. Trần Quốc Bình',
    role: ROLES.ACADEMIC_ADVISOR,
    department: 'Bộ môn Khoa học Máy tính',
  },
  {
    email: DEPARTMENT_CHAIR_EMAIL,
    password: 'Assistant@123',
    fullName: 'Lê Thanh Hương',
    role: ROLES.DEPARTMENT_CHAIR,
    faculty: 'Khoa Điện tử Viễn thông',
  },
  {
    email: FACULTY_MANAGER_EMAIL,
    password: 'Manager@123',
    fullName: 'PGS. TS. Nguyễn Văn Hùng',
    role: ROLES.FACULTY_MANAGER,
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: STUDENT_AFFAIRS_EMAIL,
    password: 'Ctsv@123',
    fullName: 'Đỗ Thị Kim Oanh',
    role: ROLES.STUDENT_AFFAIRS,
    department: 'Phòng Công tác Học sinh Sinh viên',
  },
  {
    email: PRINCIPAL_EMAIL,
    password: 'Principal@123',
    fullName: 'GS. TS. Phạm Hoàng Hải',
    role: ROLES.PRINCIPAL,
    department: 'Ban Giám Hiệu',
  },
  {
    email: OFFICE_STAFF_EMAIL,
    password: 'Staff@123',
    fullName: 'Nguyễn Minh Châu',
    role: ROLES.OFFICE_STAFF,
    department: 'Văn phòng Trường',
  },
  {
    email: ADMIN_EMAIL,
    password: 'Admin@123',
    fullName: 'Quản trị viên Hệ thống',
    role: ROLES.ADMIN,
    department: 'Phòng Quản trị hệ thống',
  },
  {
    email: 'troly.khoa.cntt@ctut.edu.vn',
    password: 'Assistant@123',
    fullName: 'Trợ lý Khoa CNTT (demo)',
    role: ROLES.KHOA_ASSISTANT,
    faculty: 'Khoa Công nghệ Thông tin',
  },
  {
    email: 'troly.phong.ctsv@ctut.edu.vn',
    password: 'Assistant@123',
    fullName: 'Trợ lý phòng CTSV (demo)',
    role: ROLES.PHONG_ASSISTANT,
    department: 'Phòng Công tác Học sinh Sinh viên',
  },
  {
    email: 'troly.trungtam@ctut.edu.vn',
    password: 'Assistant@123',
    fullName: 'Trợ lý Trung tâm (demo)',
    role: ROLES.TRUNG_TAM_ASSISTANT,
    department: 'Trung tâm Công nghệ Thông tin',
  },
];

const migrateLegacyEmails = async () => {
  for (const [oldEmail, newEmail] of LEGACY_EMAIL_MAP) {
    if (oldEmail === newEmail) continue;
    const existingNew = await User.findOne({ email: newEmail });
    if (existingNew) {
      const oldDoc = await User.findOne({ email: oldEmail });
      if (oldDoc) {
        await User.deleteOne({ _id: oldDoc._id });
        console.log(`[Seeder] Removed duplicate legacy email: ${oldEmail} (kept ${newEmail})`);
      }
      continue;
    }
    const updated = await User.updateOne({ email: oldEmail }, { $set: { email: newEmail } });
    if (updated.modifiedCount > 0) {
      console.log(`[Seeder] Migrated email: ${oldEmail} → ${newEmail}`);
    }
  }
};

export const seedUsers = async () => {
  await migrateLegacyEmails();

  let created = 0;
  let skipped = 0;

  for (const userData of DEMO_USERS) {
    const exists = await User.findOne({ email: userData.email });
    if (exists) {
      skipped++;
      continue;
    }

    const { password, ...rest } = userData;
    const payload = {
      ...rest,
      password: await hashPassword(password),
      isActive: true,
    };

    if (
      payload.role === ROLES.KHOA_ASSISTANT ||
      payload.role === ROLES.FACULTY_MANAGER ||
      payload.role === ROLES.DEPUTY_FACULTY_MANAGER
    ) {
      if (!payload.khoaId && payload.faculty) {
        const khoa = await Khoa.findOne({
          name: { $regex: `^${String(payload.faculty).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        }).select('_id name');
        if (khoa) {
          payload.khoaId = khoa._id;
          payload.faculty = khoa.name;
        }
      }
    }

    await User.create(payload);
    created++;
    console.log(`[Seeder] Created user: ${userData.email}`);
  }

  // Bổ sung khoaId cho trợ lý khoa demo nếu thiếu (seed lần sau / DB cũ)
  const facultyAssistants = await User.find({
    role: ROLES.KHOA_ASSISTANT,
    $or: [{ khoaId: null }, { khoaId: { $exists: false } }],
    faculty: { $ne: '' },
  }).select('_id faculty');
  for (const u of facultyAssistants) {
    const escaped = String(u.faculty).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const khoa = await Khoa.findOne({
      name: { $regex: `^${escaped}$`, $options: 'i' },
    }).select('_id name');
    if (khoa) {
      await User.updateOne(
        { _id: u._id },
        { $set: { khoaId: khoa._id, faculty: khoa.name } },
      );
      console.log(`[Seeder] Linked khoaId for assistant ${u._id}`);
    }
  }

  console.log(`[Seeder] Users — created: ${created}, skipped: ${skipped}`);
};
