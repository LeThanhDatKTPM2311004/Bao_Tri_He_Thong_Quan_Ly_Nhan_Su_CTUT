/**
 * Test đầu-cuối: sinh viên nộp đơn học lại → duyệt qua từng bước theo quy trình đã cấu hình.
 * Ở mỗi bước, kiểm tra TẤT CẢ tài khoản cán bộ xem ai nhìn thấy hồ sơ
 * (chứng minh hồ sơ chỉ tới đúng phòng / trung tâm đã cấu hình).
 *
 * Chạy: node --env-file=.env scripts/e2e-workflow-hoclai.mjs [--keep]
 * Mặc định xóa sạch dữ liệu test sau khi chạy; thêm --keep để giữ lại xem trên UI.
 */
import './_disableEmailForTest.mjs';

import mongoose from 'mongoose';
import User from '../src/modules/users/user.model.js';
import LoaiDon from '../src/modules/importForms/LoaiDon.model.js';
import GeneratedFile from '../src/modules/convertFileAndSubmit/GeneratedFile.model.js';
import { WorkflowInstance } from '../src/modules/workflows/workflow.model.js';
import Notification from '../src/modules/notifications/notification.model.js';
import * as workflowService from '../src/modules/workflows/workflow.service.js';
import { ROLES, ROLE_LABELS } from '../src/config/roles.js';

const keepData = process.argv.includes('--keep');
const label = (role) => ROLE_LABELS[role] || role;

await mongoose.connect(process.env.MONGO_URI);

const cleanup = async (fileId) => {
  if (!fileId) return;
  await Promise.all([
    GeneratedFile.deleteOne({ _id: fileId }),
    WorkflowInstance.deleteMany({ generatedFileId: fileId }),
    Notification.deleteMany({ entityId: fileId }),
  ]);
};

let createdFileId = null;

try {
  const loaiDon = await LoaiDon.findOne({ tenDon: { $regex: 'học lại', $options: 'i' } }).lean();
  if (!loaiDon) throw new Error('Không tìm thấy biểu mẫu đơn học lại');

  const student = await User.findOne({
    role: ROLES.STUDENT,
    isActive: true,
    sinhVienId: { $ne: null },
  })
    .select('fullName email')
    .lean();
  if (!student) throw new Error('Không có tài khoản sinh viên hoạt động');

  const staffList = await User.find({
    role: { $nin: [ROLES.STUDENT, ROLES.ADMIN] },
    isActive: true,
  })
    .select('fullName email role department')
    .lean();

  console.log('==================================================');
  console.log(`Biểu mẫu   : ${loaiDon.tenDon}`);
  console.log(`Sinh viên  : ${student.fullName} <${student.email}>`);
  console.log(`Cán bộ có trong hệ thống: ${staffList.length} tài khoản`);
  console.log('==================================================\n');

  // ---- Bước 0: sinh viên nộp đơn (giống controller convertFileAndSubmit) ----
  const file = await GeneratedFile.create({
    tenDon: loaiDon.tenDon,
    tenNguoiGui: student.fullName,
    duongDanFile: 'https://example.local/test-e2e-hoc-lai.pdf',
    trangThai: 'cho_duyet',
    submittedBy: student._id,
    loaiDonId: loaiDon._id,
    sourceType: 'uploaded',
    originalFileName: 'test-e2e-hoc-lai.pdf',
    fileMimeType: 'application/pdf',
  });
  createdFileId = file._id;

  const instance = await workflowService.startWorkflowForGeneratedFile(file._id, student._id);
  console.log(`>> Sinh viên đã nộp đơn. Mã hồ sơ: ${String(file._id).slice(-6).toUpperCase()}`);
  console.log(`   Workflow instance: ${instance._id}\n`);

  const workflow = await workflowService.resolveWorkflowForLoaiDon(loaiDon._id);
  const totalSteps = workflow.steps.length;

  // ---- Duyệt lần lượt từng bước ----
  for (let i = 0; i < totalSteps; i += 1) {
    const current = await WorkflowInstance.findById(instance._id).lean();
    if (!current || current.status === 'completed') break;

    const stepDef = workflow.steps.find((s) => s.stepOrder === current.currentStepOrder);
    const unitText = stepDef.assigneeDepartment ? ` — ${stepDef.assigneeDepartment}` : '';
    console.log(`--- BƯỚC ${stepDef.stepOrder}/${totalSteps}: ${label(stepDef.role)}${unitText} ---`);

    // Ai đang nhìn thấy hồ sơ này trong "Hồ sơ chờ ký"?
    const seers = [];
    for (const staff of staffList) {
      const tasks = await workflowService.getPendingTasks({ id: staff._id });
      if (tasks.some((t) => String(t.submissionId) === String(file._id))) {
        seers.push(staff);
      }
    }

    const sameRoleCount = staffList.filter((s) => s.role === stepDef.role).length;
    console.log(`  Tài khoản cùng vai trò «${label(stepDef.role)}»: ${sameRoleCount}`);
    if (!seers.length) {
      console.log('  !! KHÔNG AI nhận được hồ sơ — dừng test');
      break;
    }
    for (const s of seers) {
      console.log(
        `  ✓ Thấy hồ sơ: ${s.fullName} <${s.email}> [${label(s.role)}]${
          s.department ? ` — ${s.department}` : ''
        }`,
      );
    }
    const blocked = staffList.filter(
      (s) => s.role === stepDef.role && !seers.some((x) => String(x._id) === String(s._id)),
    );
    for (const s of blocked) {
      console.log(
        `  ✗ KHÔNG thấy (đúng mong đợi): ${s.fullName} [${label(s.role)}]${
          s.department ? ` — ${s.department}` : ''
        }`,
      );
    }

    // Người đúng vai trò bước này bấm duyệt
    const approver = seers.find((s) => s.role === stepDef.role) || seers[0];
    await workflowService.approve(file._id, { id: approver._id }, {
      comment: `Duyệt tự động (test E2E) — bước ${stepDef.stepOrder}`,
    });
    console.log(`  → ${approver.fullName} đã DUYỆT\n`);
  }

  // ---- Kết quả cuối ----
  const finalInstance = await WorkflowInstance.findById(instance._id).lean();
  const finalFile = await GeneratedFile.findById(file._id).lean();

  console.log('==================== KẾT QUẢ ====================');
  console.log(`Trạng thái workflow : ${finalInstance.status}`);
  console.log(`Trạng thái hồ sơ    : ${finalFile.trangThai}`);
  console.log(`Số bước đã xử lý    : ${finalInstance.steps.length}/${totalSteps}`);
  console.log('Lịch sử xử lý:');
  for (const s of finalInstance.steps) {
    const who = await User.findById(s.handledBy).select('fullName department role').lean();
    console.log(
      `  ${s.stepOrder}. ${s.stepName} → ${s.action} bởi ${who?.fullName || '?'}${
        who?.department ? ` (${who.department})` : ''
      }`,
    );
  }
  console.log('=================================================');
} catch (error) {
  console.error('LỖI:', error.message);
} finally {
  if (keepData) {
    console.log(`\n(Giữ lại dữ liệu test — hồ sơ ${createdFileId})`);
  } else {
    await cleanup(createdFileId);
    console.log('\n(Đã xóa sạch dữ liệu test khỏi database)');
  }
  await mongoose.disconnect();
}
