/**
 * Seed dữ liệu giả lập hệ thống đã vận hành ~1 năm — đủ các tình huống thực tế.
 *
 * Bao gồm:
 * - GeneratedFile + WorkflowInstance trải 12 tháng
 * - Trạng thái: completed / in_progress / pending / rejected / overdue / cancelled
 * - Hồ sơ nháp (không instance)
 * - Thông báo đa loại cho cán bộ / trợ lý / admin
 * - Phân bố theo mùa vụ (đầu học kỳ nhiều hơn)
 *
 * Chạy:
 *   npm run seed:year-demo
 *   npm run seed:year-demo -- --count=800
 *   npm run seed:year-demo -- --replace
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../../config/database.js';
import User from '../../modules/users/user.model.js';
import LoaiDon from '../../modules/importForms/LoaiDon.model.js';
import GeneratedFile from '../../modules/convertFileAndSubmit/GeneratedFile.model.js';
import Notification from '../../modules/notifications/notification.model.js';
import { Workflow, WorkflowInstance } from '../../modules/workflows/workflow.model.js';
import { ROLES } from '../../config/roles.js';
import { hashPassword } from '../../shared/utils/hashPassword.js';
import Khoa from '../../modules/organization/models/khoa.model.js';
import Lop from '../../modules/organization/models/lop.model.js';

const DEMO_MARKER = 'demo://year-activity/';
const DASHBOARD_MARKER = 'demo://dashboard-stats/';
const DEFAULT_COUNT = 720;

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
  'Nguyễn Thị Hoa',
  'Trần Văn Khoa',
  'Lê Thị Mỹ',
  'Phạm Minh Nhật',
  'Hoàng Quốc Bảo',
  'Vũ Thị Cẩm',
  'Đỗ Văn Đạt',
  'Bùi Thị Giang',
  'Ngô Minh Hải',
  'Phan Thị Hương',
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
    stepName: 'Trưởng khoa',
    role: ROLES.FACULTY_MANAGER,
    action: 'sign',
    isRequired: true,
    allowReject: true,
    deadlineDays: 5,
  },
];

const OFFICE_STEPS = [
  ...DEFAULT_STEPS.slice(0, 2),
  {
    stepOrder: 3,
    stepName: 'Trưởng phòng Đào tạo',
    role: ROLES.DEPARTMENT_HEAD,
    action: 'sign',
    isRequired: true,
    allowReject: true,
    deadlineDays: 5,
    assigneeDepartment: 'Phòng Đào tạo',
  },
];

const PROCEDURE_WEIGHTS = {
  'đơn học lại': 22,
  'đơn xin thôi học': 8,
  'giấy giới thiệu thực tập': 16,
  'giấy xác nhận hoàn cảnh khó khăn': 9,
  'đơn cấp lại thẻ sinh viên': 14,
  'đơn bảo lưu': 12,
  'đơn xin nghỉ học tạm thời': 7,
  'đơn xin miễn giảm học phí': 6,
  'đơn xin chuyển lớp': 6,
};

/** Mix trạng thái hồ sơ có quy trình */
const STATUS_MIX = [
  { status: 'completed', weight: 48 },
  { status: 'in_progress', weight: 14 },
  { status: 'pending', weight: 8 },
  { status: 'rejected', weight: 12 },
  { status: 'overdue', weight: 10 },
  { status: 'cancelled', weight: 8 },
];

const FILE_STATUS_BY_WI = {
  completed: 'da_duyet',
  rejected: 'tu_choi',
  overdue: 'tre_han',
  pending: 'cho_duyet',
  in_progress: 'cho_duyet',
  cancelled: 'da_huy',
};

const CANCEL_REASONS = [
  'Sinh viên tự hủy vì nộp sai mẫu',
  'Không còn nhu cầu xử lý',
  'Trùng hồ sơ đã nộp trước đó',
  'Thiếu giấy tờ bổ sung, SV rút đơn',
];

const parseArgs = () => {
  const args = process.argv.slice(2);
  const replace = args.includes('--replace');
  const countArg = args.find((a) => a.startsWith('--count='));
  const count = countArg
    ? Math.max(100, Number(countArg.split('=')[1]) || DEFAULT_COUNT)
    : DEFAULT_COUNT;
  return { replace, count };
};

const mulberry32 = (seed) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
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

const daysInMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();

const randomDateInMonth = (year, monthIndex, rand) => {
  const day = 1 + Math.floor(rand() * daysInMonth(year, monthIndex));
  const hour = 7 + Math.floor(rand() * 11);
  const minute = Math.floor(rand() * 60);
  return new Date(year, monthIndex, day, hour, minute, Math.floor(rand() * 60));
};

/** 12 tháng gần nhất — trọng số theo mùa vụ học vụ */
const buildLastTwelveMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = d.getMonth(); // 0-11
    // Đầu HK (8–10, 1–3) cao hơn; hè thấp hơn
    let weight = 8;
    if ([8, 9, 1, 2].includes(m)) weight = 14;
    else if ([7, 10, 0, 3].includes(m)) weight = 11;
    else if ([5, 6].includes(m)) weight = 5;
    months.push({ year: d.getFullYear(), monthIndex: m, weight });
  }
  return months;
};

const ensureWorkflowsForLoaiDon = async (loaiDons, rand) => {
  let defaultWf = await Workflow.findOne({ loaiDonId: null, isActive: true }).sort({ createdAt: 1 });
  if (!defaultWf) {
    defaultWf = await Workflow.create({
      name: 'Quy trình mặc định (year-demo)',
      steps: DEFAULT_STEPS,
      isActive: true,
      isDefault: true,
    });
  }

  const map = new Map();
  for (const loai of loaiDons) {
    let wf = null;
    if (loai.workflowId) wf = await Workflow.findById(loai.workflowId);
    if (!wf) wf = await Workflow.findOne({ loaiDonId: loai._id });

    const useOffice = rand() < 0.22;
    if (!wf) {
      wf = await Workflow.create({
        name: `Quy trình — ${loai.tenDon}`,
        loaiDonId: loai._id,
        steps: useOffice ? OFFICE_STEPS : DEFAULT_STEPS,
        isActive: true,
      });
      await LoaiDon.updateOne({ _id: loai._id }, { $set: { workflowId: wf._id } });
      console.log(`[YearDemo] Tạo workflow cho: ${loai.tenDon}${useOffice ? ' (có bước phòng)' : ''}`);
    } else if (!loai.workflowId) {
      await LoaiDon.updateOne({ _id: loai._id }, { $set: { workflowId: wf._id } });
    }
    map.set(String(loai._id), wf);
  }
  return { map, defaultWf };
};

const ensureExtraStudents = async (rand) => {
  const existing = await User.countDocuments({ role: ROLES.STUDENT, isActive: { $ne: false } });
  if (existing >= 12) return existing;

  const khoas = await Khoa.find().select('_id name').lean();
  const lops = await Lop.find().select('_id khoaId boMonId code').lean();
  const password = await hashPassword('Student@123');
  let created = 0;

  for (let i = existing; i < 18; i += 1) {
    const email = `sv.demo.year${String(i + 1).padStart(2, '0')}@student.ctuet.edu.vn`;
    const found = await User.findOne({ email });
    if (found) continue;
    const lop = lops.length ? lops[Math.floor(rand() * lops.length)] : null;
    const khoa = lop
      ? khoas.find((k) => String(k._id) === String(lop.khoaId))
      : khoas[Math.floor(rand() * Math.max(khoas.length, 1))];
    await User.create({
      email,
      password,
      fullName: FAKE_NAMES[i % FAKE_NAMES.length],
      role: ROLES.STUDENT,
      studentId: `SVY${20260000 + i}`,
      khoaId: lop?.khoaId || khoa?._id || null,
      boMonId: lop?.boMonId || null,
      lopId: lop?._id || null,
      faculty: khoa?.name || '',
      isActive: true,
    });
    created += 1;
  }
  if (created) console.log(`[YearDemo] Đã tạo thêm ${created} tài khoản SV demo`);
  return existing + created;
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
    return { steps, currentStepOrder: 1, currentStepEnteredAt: createdAt };
  }

  if (status === 'cancelled') {
    const mid = Math.min(2, steps.length);
    for (let i = 0; i < mid - 1; i += 1) {
      const handledAt = new Date(createdAt.getTime() + (i + 1) * 20 * 3600 * 1000);
      steps[i].handledBy = pickStaff();
      steps[i].action = defs[i]?.action || 'review';
      steps[i].comment = 'Đã xử lý (demo)';
      steps[i].handledAt = handledAt;
    }
    const withdrawAt = new Date(createdAt.getTime() + mid * 24 * 3600 * 1000);
    steps[mid - 1] = {
      ...steps[mid - 1],
      handledBy: null,
      action: 'withdrawn',
      comment: 'Sinh viên hủy đơn (demo)',
      handledAt: withdrawAt,
    };
    return { steps, currentStepOrder: mid, currentStepEnteredAt: createdAt };
  }

  if (status === 'in_progress' || status === 'overdue') {
    const mid = Math.min(Math.max(2, Math.ceil(steps.length * 0.66)), steps.length);
    for (let i = 0; i < mid - 1; i += 1) {
      const handledAt = new Date(createdAt.getTime() + (i + 1) * 24 * 3600 * 1000);
      steps[i].handledBy = pickStaff();
      steps[i].action = defs[i]?.action || 'review';
      steps[i].comment = 'Đã xử lý (demo)';
      steps[i].handledAt = handledAt;
    }
    const entered = new Date(
      createdAt.getTime() +
        (status === 'overdue' ? 10 + Math.floor(rand() * 20) : 2 + Math.floor(rand() * 5)) *
          24 *
          3600 *
          1000,
    );
    return {
      steps,
      currentStepOrder: mid,
      currentStepEnteredAt: entered > new Date() ? createdAt : entered,
    };
  }

  if (status === 'rejected') {
    const rejectAt = Math.min(steps.length, 1 + Math.floor(rand() * Math.min(2, steps.length)));
    for (let i = 0; i < rejectAt; i += 1) {
      const handledAt = new Date(createdAt.getTime() + (i + 1) * 18 * 3600 * 1000);
      steps[i].handledBy = pickStaff();
      steps[i].action = i === rejectAt - 1 ? 'reject' : defs[i]?.action || 'review';
      steps[i].comment =
        i === rejectAt - 1 ? 'Hồ sơ chưa đủ điều kiện (demo)' : 'Đã xem xét (demo)';
      steps[i].handledAt = handledAt;
    }
    return { steps, currentStepOrder: rejectAt, currentStepEnteredAt: createdAt };
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
  return { steps, currentStepOrder: steps.length, currentStepEnteredAt: createdAt };
};

const clearPreviousDemo = async () => {
  const markers = [DEMO_MARKER, DASHBOARD_MARKER];
  const demoFiles = await GeneratedFile.find({
    duongDanFile: { $regex: `^(${markers.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})` },
  })
    .select('_id')
    .lean();
  const ids = demoFiles.map((f) => f._id);
  if (!ids.length) {
    console.log('[YearDemo] Không có dữ liệu demo cũ để xóa');
  } else {
    const [delInst, delFiles, delNoti] = await Promise.all([
      WorkflowInstance.deleteMany({ generatedFileId: { $in: ids } }),
      GeneratedFile.deleteMany({ _id: { $in: ids } }),
      Notification.deleteMany({
        $or: [{ entityId: { $in: ids } }, { title: { $regex: '\\(demo năm\\)' } }],
      }),
    ]);
    console.log(
      `[YearDemo] Đã xóa demo cũ: ${delFiles.deletedCount} file, ${delInst.deletedCount} instance, ${delNoti.deletedCount} thông báo`,
    );
  }

  // Xóa luôn nháp demo
  await GeneratedFile.deleteMany({
    duongDanFile: { $regex: `^${DEMO_MARKER}draft/` },
  });
};

const buildNotifications = ({
  fileDocs,
  instanceDocs,
  staff,
  assistants,
  admins,
  rand,
}) => {
  const recipients = [...staff, ...assistants, ...admins];
  if (!recipients.length) return [];

  const docs = [];
  const pickRecipient = (preferAssistants = false) => {
    const pool = preferAssistants && assistants.length ? assistants : recipients;
    return pool[Math.floor(rand() * pool.length)];
  };

  for (let i = 0; i < Math.min(instanceDocs.length, 280); i += 1) {
    if (rand() > 0.55) continue;
    const inst = instanceDocs[i];
    const file = fileDocs[i];
    const createdAt = inst.createdAt || file.createdAt;
    const recipient = pickRecipient(
      inst.status === 'overdue' || inst.currentStepOrder >= 3,
    );

    let type = 'submission_in_progress';
    let title = `Đơn đang xử lý: ${file.tenDon} (demo năm)`;
    let message = `Đơn của ${file.tenNguoiGui} đang ở bước xử lý — dữ liệu demo 1 năm.`;

    if (inst.status === 'overdue') {
      type = 'deadline_warning';
      title = `Hồ sơ quá hạn: ${file.tenDon} (demo năm)`;
      message = `Đơn của ${file.tenNguoiGui} đã quá hạn — hãy nhắc lãnh đạo đơn vị xử lý.`;
    } else if (inst.status === 'completed') {
      type = 'submission_approved';
      title = `Hồ sơ hoàn tất: ${file.tenDon} (demo năm)`;
      message = `Đơn của ${file.tenNguoiGui} đã được duyệt hoàn tất.`;
    } else if (inst.status === 'rejected') {
      type = 'submission_rejected';
      title = `Hồ sơ bị từ chối: ${file.tenDon} (demo năm)`;
      message = `Đơn của ${file.tenNguoiGui} bị từ chối trong quy trình.`;
    } else if (inst.status === 'cancelled') {
      type = 'submission_cancelled';
      title = `Sinh viên đã hủy đơn: ${file.tenDon} (demo năm)`;
      message = `${file.tenNguoiGui} đã hủy đơn.`;
    } else if (inst.status === 'pending' || inst.status === 'in_progress') {
      type = rand() < 0.5 ? 'signature_required' : 'submission_in_progress';
      title =
        type === 'signature_required'
          ? `Hồ sơ chờ xử lý: ${file.tenDon} (demo năm)`
          : `Cần nhắc duyệt: ${file.tenDon} (demo năm)`;
      message =
        type === 'signature_required'
          ? `Có hồ sơ mới cần xử lý của ${file.tenNguoiGui}.`
          : `Đơn của ${file.tenNguoiGui} đang chờ lãnh đạo ký — hãy nhắc duyệt.`;
    }

    docs.push({
      recipientId: recipient._id,
      type,
      title,
      message,
      entityType: 'GeneratedFile',
      entityId: file._id,
      isRead: rand() < 0.45,
      readAt: rand() < 0.45 ? new Date(createdAt.getTime() + 2 * 3600 * 1000) : null,
      channels: ['in_app'],
      createdAt,
      updatedAt: createdAt,
    });
  }

  return docs;
};

const run = async () => {
  const { replace, count } = parseArgs();
  await connectDatabase();
  console.log(`[YearDemo] Bắt đầu seed 1 năm (count≈${count}, replace=${replace})`);

  const rand = mulberry32(20260807);
  if (replace) await clearPreviousDemo();
  await ensureExtraStudents(rand);

  const [loaiDons, students, staff, assistants, admins] = await Promise.all([
    LoaiDon.find({ isActive: { $ne: false } }).lean(),
    User.find({ role: ROLES.STUDENT, isActive: { $ne: false } })
      .select('_id fullName studentId khoaId')
      .lean(),
    User.find({
      role: {
        $nin: [
          ROLES.STUDENT,
          ROLES.ADMIN,
          ROLES.KHOA_ASSISTANT,
          ROLES.PHONG_ASSISTANT,
          ROLES.TRUNG_TAM_ASSISTANT,
        ],
      },
      isActive: { $ne: false },
    })
      .select('_id role')
      .lean(),
    User.find({
      role: {
        $in: [ROLES.KHOA_ASSISTANT, ROLES.PHONG_ASSISTANT, ROLES.TRUNG_TAM_ASSISTANT],
      },
      isActive: { $ne: false },
    })
      .select('_id role')
      .lean(),
    User.find({ role: ROLES.ADMIN, isActive: { $ne: false } })
      .select('_id role')
      .lean(),
  ]);

  if (!loaiDons.length) {
    throw new Error('Chưa có LoaiDon — hãy import mẫu đơn trước khi seed');
  }
  if (!students.length) {
    throw new Error('Chưa có sinh viên — không gắn được submittedBy');
  }

  const { map: wfMap } = await ensureWorkflowsForLoaiDon(loaiDons, rand);
  const staffIds = staff.map((s) => s._id);
  const months = buildLastTwelveMonths();
  const weightedLoai = loaiDons.map((l) => ({
    loai: l,
    weight: PROCEDURE_WEIGHTS[String(l.tenDon || '').toLowerCase()] ?? 10,
  }));

  const fileDocs = [];
  const instanceDocs = [];
  const now = new Date();

  // ~4% hồ sơ nháp (không instance)
  const draftCount = Math.max(8, Math.round(count * 0.04));
  for (let i = 0; i < draftCount; i += 1) {
    const { loai } = pickWeighted(weightedLoai, (x) => x.weight, rand);
    const student = students[Math.floor(rand() * students.length)];
    const month = pickWeighted(months, (m) => m.weight, rand);
    let createdAt = randomDateInMonth(month.year, month.monthIndex, rand);
    if (createdAt > now) createdAt = new Date(now.getTime() - 3600 * 1000);
    const fileId = new mongoose.Types.ObjectId();
    fileDocs.push({
      _id: fileId,
      tenDon: loai.tenDon,
      tenNguoiGui: student.fullName || FAKE_NAMES[i % FAKE_NAMES.length],
      duongDanFile: `${DEMO_MARKER}draft/${fileId}.docx`,
      submittedBy: student._id,
      currentStepOrder: 0,
      trangThai: 'nhap',
      loaiDonId: loai._id,
      sourceType: 'generated',
      originalFileName: `draft-demo-${i + 1}.docx`,
      fileMimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      createdAt,
      updatedAt: createdAt,
    });
  }

  const flowCount = count - draftCount;
  for (let i = 0; i < flowCount; i += 1) {
    const { loai } = pickWeighted(weightedLoai, (x) => x.weight, rand);
    const workflow = wfMap.get(String(loai._id));
    const student = students[Math.floor(rand() * students.length)];
    const displayName =
      rand() < 0.7
        ? student.fullName || FAKE_NAMES[Math.floor(rand() * FAKE_NAMES.length)]
        : FAKE_NAMES[Math.floor(rand() * FAKE_NAMES.length)];
    const month = pickWeighted(months, (m) => m.weight, rand);
    let createdAt = randomDateInMonth(month.year, month.monthIndex, rand);
    if (createdAt > now) createdAt = new Date(now.getTime() - Math.floor(rand() * 5) * 3600 * 1000);

    const status = pickWeighted(STATUS_MIX, (s) => s.weight, rand).status;

    let completedAt = null;
    let updatedAt = createdAt;
    let cancelledAt = null;
    let cancelReason = null;

    if (status === 'completed') {
      const processDays = 2 + Math.floor(rand() * 14);
      completedAt = new Date(createdAt.getTime() + processDays * 24 * 3600 * 1000);
      if (completedAt > now) completedAt = now;
      updatedAt = completedAt;
    } else if (status === 'rejected') {
      updatedAt = new Date(createdAt.getTime() + (1 + Math.floor(rand() * 8)) * 24 * 3600 * 1000);
      if (updatedAt > now) updatedAt = now;
    } else if (status === 'cancelled') {
      cancelledAt = new Date(createdAt.getTime() + (1 + Math.floor(rand() * 6)) * 24 * 3600 * 1000);
      if (cancelledAt > now) cancelledAt = now;
      updatedAt = cancelledAt;
      cancelReason = CANCEL_REASONS[Math.floor(rand() * CANCEL_REASONS.length)];
    } else {
      updatedAt = new Date(createdAt.getTime() + Math.floor(rand() * 8) * 24 * 3600 * 1000);
      if (updatedAt > now) updatedAt = now;
    }

    const fileId = new mongoose.Types.ObjectId();
    const instanceId = new mongoose.Types.ObjectId();

    const { steps, currentStepOrder, currentStepEnteredAt } = buildStepsForStatus({
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
      cancelReason,
      cancelledAt,
      loaiDonId: loai._id,
      sourceType: 'uploaded',
      originalFileName: `year-demo-${i + 1}.pdf`,
      fileMimeType: 'application/pdf',
      createdAt,
      updatedAt,
    });

    instanceDocs.push({
      _id: instanceId,
      generatedFileId: fileId,
      workflowId: workflow._id,
      currentStepOrder,
      currentStepEnteredAt: currentStepEnteredAt || createdAt,
      status,
      steps,
      startedAt: createdAt,
      completedAt,
      createdAt,
      updatedAt,
    });
  }

  await GeneratedFile.collection.insertMany(fileDocs, { ordered: false });
  await WorkflowInstance.collection.insertMany(instanceDocs, { ordered: false });

  const notiDocs = buildNotifications({
    fileDocs: fileDocs.filter((f) => f.trangThai !== 'nhap'),
    instanceDocs,
    staff,
    assistants,
    admins,
    rand,
  });
  if (notiDocs.length) {
    await Notification.collection.insertMany(notiDocs, { ordered: false });
  }

  const byStatus = {};
  for (const d of instanceDocs) byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  byStatus.draft_nhap = draftCount;

  const byMonth = {};
  for (const d of fileDocs) {
    const dt = new Date(d.createdAt);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    byMonth[key] = (byMonth[key] || 0) + 1;
  }

  console.log('\n=== Kết quả seed demo 1 năm ===');
  console.log(`GeneratedFile : +${fileDocs.length} (gồm ${draftCount} nháp)`);
  console.log(`WorkflowInst  : +${instanceDocs.length}`);
  console.log(`Notification  : +${notiDocs.length}`);
  console.log('Theo trạng thái:', byStatus);
  console.log('Theo tháng:', byMonth);
  console.log('\nGợi ý xem: /dashboard, /reports, /reports/assistant, /workflows/assistant-monitor');
  console.log('Xóa & seed lại: npm run seed:year-demo -- --replace\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(async (err) => {
  console.error('[YearDemo] Lỗi:', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
