/**
 * Dry-run kiểm tra định tuyến quy trình cho một biểu mẫu (mặc định: đơn học lại).
 * Không ghi DB, không gửi email — chỉ tính danh sách người nhận từng bước.
 *
 * Chạy: node --env-file=.env scripts/smoke-workflow-routing.mjs [từ khóa tên đơn]
 */
import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import LoaiDon from '../src/modules/importForms/LoaiDon.model.js';
import { resolveWorkflowForLoaiDon } from '../src/modules/workflows/workflow.service.js';
import {
  findUsersForWorkflowStep,
  filterUsersBySubmissionScope,
} from '../src/modules/workflows/workflowScope.js';
import { isWorkflowOfficeUnitRole } from '../src/modules/workflows/workflow.constants.js';
import { ROLE_LABELS, ROLES } from '../src/config/roles.js';

const keyword = process.argv[2] || 'học lại';

await mongoose.connect(process.env.MONGO_URI);

const loaiDon = await LoaiDon.findOne({ tenDon: { $regex: keyword, $options: 'i' } }).lean();
if (!loaiDon) {
  console.log(`Không tìm thấy biểu mẫu chứa "${keyword}"`);
  const all = await LoaiDon.find().select('tenDon').lean();
  console.log('Các biểu mẫu hiện có:', all.map((d) => d.tenDon).join(' | '));
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`=== Biểu mẫu: ${loaiDon.tenDon} (${loaiDon._id}) ===`);

const workflow = await resolveWorkflowForLoaiDon(loaiDon._id);
console.log(`Workflow: ${workflow.name}${workflow.isDefault ? ' (MẶC ĐỊNH)' : ' (riêng)'}\n`);

// Chọn 1 sinh viên thật làm người nộp giả định
const student = await User.findOne({ role: ROLES.STUDENT, isActive: true, sinhVienId: { $ne: null } })
  .select('fullName email role khoaId boMonId lopId sinhVienId studentId')
  .lean();
if (!student) {
  console.log('Không có sinh viên hoạt động nào trong DB');
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`Người nộp giả định: ${student.fullName} <${student.email}>\n`);

// file giả — chỉ dùng để resolve khoa/bộ môn/lớp của người nộp
const fakeFile = { submittedBy: student };

for (const step of workflow.steps) {
  const roleLabel = ROLE_LABELS[step.role] || step.role;
  const unitInfo = isWorkflowOfficeUnitRole(step.role)
    ? ` | đơn vị cấu hình: ${step.assigneeDepartment || '(CHƯA CHỌN — gửi mọi tài khoản cùng vai trò)'}`
    : '';
  console.log(`Bước ${step.stepOrder}: ${step.stepName} [role=${step.role}]${unitInfo}`);

  const candidates = await findUsersForWorkflowStep(step, fakeFile);
  const recipients = await filterUsersBySubmissionScope(candidates, fakeFile, step);

  // Tổng số tài khoản cùng role để so sánh (chứng minh không gửi đại trà)
  const totalSameRole = await User.countDocuments({ role: step.role, isActive: true });

  console.log(`  → Tổng tài khoản role «${roleLabel}» đang hoạt động: ${totalSameRole}`);
  if (!recipients.length) {
    console.log('  → NHẬN HỒ SƠ: (không ai — kiểm tra cấu hình đơn vị / khoa)');
  } else {
    for (const u of recipients) {
      console.log(
        `  → NHẬN HỒ SƠ: ${u.fullName} <${u.email}>${u.department ? ` — ${u.department}` : ''}`,
      );
    }
  }
  console.log('');
}

// Liệt kê các tài khoản phòng/trung tâm để đối chiếu
console.log('=== Tài khoản phòng / trung tâm trong hệ thống ===');
const officeUsers = await User.find({
  role: {
    $in: [
      ROLES.DEPARTMENT_HEAD,
      ROLES.DEPUTY_DEPARTMENT_HEAD,
      ROLES.CENTER_DIRECTOR,
      ROLES.DEPUTY_CENTER_DIRECTOR,
    ],
  },
  isActive: true,
})
  .select('fullName email role department')
  .lean();
for (const u of officeUsers) {
  console.log(`- ${ROLE_LABELS[u.role]}: ${u.fullName} <${u.email}> — đơn vị: ${u.department || '(TRỐNG)'}`);
}

await mongoose.disconnect();
