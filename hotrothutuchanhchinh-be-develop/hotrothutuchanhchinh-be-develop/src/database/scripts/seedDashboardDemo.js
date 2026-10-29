/**
 * Seed dữ liệu ảo cho trang Tổng quan + Báo cáo & Thống kê.
 *
 * - Tạo/gắn Workflow cho từng LoaiDon (nếu chưa có)
 * - Sinh GeneratedFile + WorkflowInstance trải 6 tháng gần nhất
 * - Phân bố trạng thái & loại đơn đa dạng để biểu đồ nhìn sống động
 *
 * Chạy:
 *   npm run seed:dashboard-demo
 *   npm run seed:dashboard-demo -- --count=220
 *   npm run seed:dashboard-demo -- --replace   # xóa demo cũ rồi seed lại
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import LoaiDon from '../../modules/importForms/LoaiDon.model.js';
import GeneratedFile from '../../modules/convertFileAndSubmit/GeneratedFile.model.js';
import { Workflow, WorkflowInstance } from '../../modules/workflows/workflow.model.js';
import { ROLES } from '../../config/roles.js';

const DEMO_MARKER = 'demo://dashboard-stats/';
const DEFAULT_COUNT = 200;

const FAKE_NAMES = [
  'Nguyễn Văn An',
  'Trần Thị Bình',
  'Lê Minh Châu',
  'Phạm Quốc Dũng',
  'Hoàng Thị Em',
  'Võ Thanh Phong',
  'Đặng Thị Hà',
  'Bùi Văn Khoa',
  'Ngô Thị Lan',
  'Đỗ Minh Tuấn',
  'Phan Thị Mai',
  'Huỳnh Văn Nam',
  'Lý Thị Oanh',
  'Trương Quốc Phát',
  'Cao Thị Quỳnh',
  'Đinh Văn Sơn',
  'Mai Thị Trang',
  'Lương Văn Uy',
  'Tô Thị Vân',
  'Hồ Minh Đức',
];

const DEFAULT_STEPS = [
  {
    stepOrder: 1,
    stepName: 'Cố vấn học tập',
    role: ROLES.ACADEMIC_ADVISOR,
    action: 'review',
    isRequired: true,
    allowReject: true,
    deadlineDays: 3,
  },
  {
    stepOrder: 2,
    stepName: 'Trưởng bộ môn',
    role: ROLES.DEPARTMENT_CHAIR,
    action: 'approve',
    isRequired: true,
    allowReject: true,
    deadlineDays: 5,
  },
  {
    stepOrder: 3,
    stepName: 'Trưởng khoa / Phòng ban',
    role: ROLES.FACULTY_MANAGER,
    action: 'sign',
    isRequired: true,
    allowReject: true,
    deadlineDays: 5,
  },
];

/** Trọng số loại đơn (tổng ~100) — để pie chart lệch đẹp */
const PROCEDURE_WEIGHTS = {
  'đơn học lại': 28,
  'đơn xin thôi học': 12,
  'giấy giới thiệu thực tập': 18,
  'giấy xác nhận hoàn cảnh khó khăn': 10,
  'đơn cấp lại thẻ sinh viên': 16,
  'đơn bảo lưu': 16,
};

/** Trạng thái + tỷ lệ mong muốn */
const STATUS_MIX = [
  { status: 'completed', weight: 52 },
  { status: 'in_progress', weight: 15 },
  { status: 'pending', weight: 12 },
  { status: 'rejected', weight: 13 },
  { status: 'overdue', weight: 8 },
];

/** Phân bố theo tháng (6 tháng gần nhất, tăng dần) */
const MONTH_WEIGHTS = [10, 12, 15, 18, 22, 23];

const FILE_STATUS_BY_WI = {
  completed: 'da_duyet',
  rejected: 'tu_choi',
  overdue: 'tre_han',
  pending: 'cho_duyet',
  in_progress: 'cho_duyet',
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const countArg = args.find((a) => a.startsWith('--count='));
  const count = countArg ? Math.max(30, Number(countArg.split('=')[1]) || DEFAULT_COUNT) : DEFAULT_COUNT;
  return { replace, count };
};

const pickWeighted = (items, weightFn, rand) => {
  const total = items.reduce((s, item) => s + weightFn(item), 0);
  let r = rand() * total;
  for (const item of items) {
    r -= weightFn(item);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
};

/** PRNG đơn giản — seed cố định để chạy lại ổn định */
const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
};

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const randomDateInMonth = (year, monthIndex, rand) => {
  const day = 1 + Math.floor(rand() * daysInMonth(year, monthIndex));
  const hour = 8 + Math.floor(rand() * 10);
  const minute = Math.floor(rand() * 60);
  return new Date(year, monthIndex, day, hour, minute, Math.floor(rand() * 60));
};

const buildLastSixMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), monthIndex: d.getMonth(), weight: MONTH_WEIGHTS[5 - i] });
  }
  return months;
};

const ensureWorkflowsForLoaiDon = async (loaiDons) => {
  let defaultWf = await Workflow.findOne({ loaiDonId: null, isActive: true }).sort({ createdAt: 1 });
  if (!defaultWf) {
    defaultWf = await Workflow.create({
      name: 'Quy trình mặc định (demo)',
      steps: DEFAULT_STEPS,
      isActive: true,
      isDefault: true,
    });
  }

  const map = new Map();
  for (const loai of loaiDons) {
    let wf = null;
    if (loai.workflowId) {
      wf = await Workflow.findById(loai.workflowId);
    }
    if (!wf) {
      wf = await Workflow.findOne({ loaiDonId: loai._id });
    }
    if (!wf) {
      wf = await Workflow.create({
        name: `Quy trình — ${loai.tenDon}`,
        loaiDonId: loai._id,
        steps: DEFAULT_STEPS,
        isActive: true,
      });
      await LoaiDon.updateOne({ _id: loai._id }, { $set: { workflowId: wf._id } });
      console.log(`[Demo] Tạo workflow cho: ${loai.tenDon}`);
    } else if (!loai.workflowId) {
      await LoaiDon.updateOne({ _id: loai._id }, { $set: { workflowId: wf._id } });
    }
    map.set(String(loai._id), wf);
  }
  return { map, defaultWf };
};

const buildStepsForStatus = ({ status, workflow, staffIds, createdAt, completedAt, rand }) => {
  const defs = workflow.steps?.length ? workflow.steps : DEFAULT_STEPS;
  const steps = defs.map((s) => ({
    stepOrder: s.stepOrder,
    stepName: s.stepName,
    assignedRole: s.role,
    handledBy: null,
    action: null,
    comment: null,
    handledAt: null,
    signatureId: null,
  }));

  const pickStaff = () => staffIds[Math.floor(rand() * staffIds.length)] || null;

  if (status === 'pending') {
    return { steps, currentStepOrder: 1 };
  }

  if (status === 'in_progress' || status === 'overdue') {
    const mid = Math.min(2, steps.length);
    for (let i = 0; i < mid - 1; i += 1) {
      const handledAt = new Date(createdAt.getTime() + (i + 1) * 24 * 3600 * 1000);
      steps[i].handledBy = pickStaff();
      steps[i].action = defs[i]?.action || 'review';
      steps[i].comment = 'Đã xử lý (demo)';
      steps[i].handledAt = handledAt;
    }
    return { steps, currentStepOrder: mid };
  }

  if (status === 'rejected') {
    const rejectAt = Math.min(steps.length, 1 + Math.floor(rand() * Math.min(2, steps.length)));
    for (let i = 0; i < rejectAt; i += 1) {
      const handledAt = new Date(createdAt.getTime() + (i + 1) * 18 * 3600 * 1000);
      steps[i].handledBy = pickStaff();
      steps[i].action = i === rejectAt - 1 ? 'reject' : defs[i]?.action || 'review';
      steps[i].comment = i === rejectAt - 1 ? 'Hồ sơ chưa đủ điều kiện (demo)' : 'Đã xem xét (demo)';
      steps[i].handledAt = handledAt;
    }
    return { steps, currentStepOrder: rejectAt };
  }

  // completed
  for (let i = 0; i < steps.length; i += 1) {
    const progress =
      steps.length === 1
        ? completedAt
        : new Date(
            createdAt.getTime() +
              ((completedAt.getTime() - createdAt.getTime()) * (i + 1)) / steps.length,
          );
    steps[i].handledBy = pickStaff();
    steps[i].action = defs[i]?.action || (i === steps.length - 1 ? 'sign' : 'approve');
    steps[i].comment = i === steps.length - 1 ? 'Đã ký duyệt (demo)' : 'Đồng ý chuyển tiếp (demo)';
    steps[i].handledAt = progress;
  }
  return { steps, currentStepOrder: steps.length };
};

const clearPreviousDemo = async () => {
  const demoFiles = await GeneratedFile.find({ duongDanFile: { $regex: `^${DEMO_MARKER}` } })
    .select('_id')
    .lean();
  const ids = demoFiles.map((f) => f._id);
  if (!ids.length) {
    console.log('[Demo] Không có dữ liệu demo cũ để xóa');
    return;
  }
  const [delInst, delFiles] = await Promise.all([
    WorkflowInstance.deleteMany({ generatedFileId: { $in: ids } }),
    GeneratedFile.deleteMany({ _id: { $in: ids } }),
  ]);
  console.log(`[Demo] Đã xóa demo cũ: ${delFiles.deletedCount} file, ${delInst.deletedCount} instance`);
};

const run = async () => {
  const { replace, count } = parseArgs();
  await connectDatabase();
  console.log(`[Demo] Bắt đầu seed (count=${count}, replace=${replace})`);

  if (replace) await clearPreviousDemo();

  const [loaiDons, students, staff] = await Promise.all([
    LoaiDon.find({ isActive: { $ne: false } }).lean(),
    User.find({ role: ROLES.STUDENT, isActive: { $ne: false } })
      .select('_id fullName studentId')
      .lean(),
    User.find({ role: { $nin: [ROLES.STUDENT, ROLES.ADMIN] }, isActive: { $ne: false } })
      .select('_id')
      .lean(),
  ]);

  if (!loaiDons.length) {
    throw new Error('Chưa có LoaiDon trong DB — hãy import mẫu đơn trước');
  }
  if (!students.length) {
    throw new Error('Chưa có tài khoản sinh viên — cần ít nhất 1 SV để gắn submittedBy');
  }

  const { map: wfMap } = await ensureWorkflowsForLoaiDon(loaiDons);
  const staffIds = staff.map((s) => s._id);
  const months = buildLastSixMonths();
  const rand = mulberry32(20260731);

  const weightedLoai = loaiDons.map((l) => ({
    loai: l,
    weight: PROCEDURE_WEIGHTS[l.tenDon] ?? 10,
  }));

  const fileDocs = [];
  const instanceDocs = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const { loai } = pickWeighted(weightedLoai, (x) => x.weight, rand);
    const workflow = wfMap.get(String(loai._id));
    const student = students[Math.floor(rand() * students.length)];
    const displayName = FAKE_NAMES[Math.floor(rand() * FAKE_NAMES.length)];
    const month = pickWeighted(months, (m) => m.weight, rand);
    let createdAt = randomDateInMonth(month.year, month.monthIndex, rand);
    if (createdAt > now) createdAt = new Date(now.getTime() - Math.floor(rand() * 3) * 3600 * 1000);

    const status = pickWeighted(STATUS_MIX, (s) => s.weight, rand).status;

    let completedAt = null;
    let updatedAt = createdAt;
    if (status === 'completed') {
      const processDays = 1 + Math.floor(rand() * 12);
      completedAt = new Date(createdAt.getTime() + processDays * 24 * 3600 * 1000);
      if (completedAt > now) completedAt = now;
      updatedAt = completedAt;
    } else if (status === 'rejected') {
      const processDays = 1 + Math.floor(rand() * 7);
      updatedAt = new Date(createdAt.getTime() + processDays * 24 * 3600 * 1000);
      if (updatedAt > now) updatedAt = now;
    } else {
      updatedAt = new Date(createdAt.getTime() + Math.floor(rand() * 5) * 24 * 3600 * 1000);
      if (updatedAt > now) updatedAt = now;
    }

    const fileId = new mongoose.Types.ObjectId();
    const instanceId = new mongoose.Types.ObjectId();

    const { steps, currentStepOrder } = buildStepsForStatus({
      status,
      workflow,
      staffIds,
      createdAt,
      completedAt: completedAt || updatedAt,
      rand,
    });

    fileDocs.push({
      _id: fileId,
      tenDon: loai.tenDon,
      tenNguoiGui: displayName,
      duongDanFile: `${DEMO_MARKER}${fileId}.pdf`,
      submittedBy: student._id,
      workflowInstanceId: instanceId,
      currentStepOrder,
      trangThai: FILE_STATUS_BY_WI[status] || 'cho_duyet',
      loaiDonId: loai._id,
      sourceType: 'uploaded',
      originalFileName: `demo-${i + 1}.pdf`,
      fileMimeType: 'application/pdf',
      createdAt,
    });

    instanceDocs.push({
      _id: instanceId,
      generatedFileId: fileId,
      workflowId: workflow._id,
      currentStepOrder,
      currentStepEnteredAt: createdAt,
      status,
      steps,
      startedAt: createdAt,
      completedAt,
      createdAt,
      updatedAt,
    });
  }

  // Insert trực tiếp collection để giữ createdAt/updatedAt tùy chỉnh
  await GeneratedFile.collection.insertMany(fileDocs, { ordered: false });
  await WorkflowInstance.collection.insertMany(instanceDocs, { ordered: false });

  const byStatus = {};
  for (const d of instanceDocs) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }
  const byProc = {};
  for (const d of fileDocs) {
    byProc[d.tenDon] = (byProc[d.tenDon] || 0) + 1;
  }

  console.log('\n=== Kết quả seed demo ===');
  console.log(`GeneratedFile : +${fileDocs.length}`);
  console.log(`WorkflowInst  : +${instanceDocs.length}`);
  console.log('Theo trạng thái:', byStatus);
  console.log('Theo loại đơn:', byProc);
  console.log('\nMở /dashboard và /reports để xem biểu đồ.');
  console.log('Xóa & seed lại: npm run seed:dashboard-demo -- --replace\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[Demo] Lỗi:', err.message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
