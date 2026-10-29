import * as workflowRepository from './workflow.repository.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import User from '../users/user.model.js';
import {
  getCurrentStepDef,
  getNextStep,
  normalizeDeadlineDays,
  getStepDeadlineAt,
} from './engines/workflowEngine.js';
import {
  isSubmissionInApproverScope,
  isSubmissionInAssistantUnitScope,
  isWaitingLeaderStepForAssistant,
  isAssistantOverviewRole,
  listOfficeUnitsFromUsers,
  userCanHandleWorkflowStep,
} from './workflowScope.js';
import { ensureStudentUserLinked } from '../users/studentProfile.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import {
  WORKFLOW_APPROVER_ROLES,
  DEFAULT_WORKFLOW_STEPS,
  isWorkflowOfficeUnitRole,
} from './workflow.constants.js';
import * as workflowEmail from './workflowEmail.service.js';
import { applyOverdueIfNeeded } from './workflowOverdue.service.js';
import { ROLES, ROLE_LABELS, isAssistantRole } from '../../config/roles.js';
import { writeAuditLog } from '../auditLogs/auditLog.service.js';

const STAFF_SCOPE_SELECT =
  'email fullName role khoaId boMonId lopId giangVienId studentId sinhVienId isActive department faculty';

/** Trưởng/phó khoa, trưởng/phó bộ môn — xem overview đơn trong phạm vi */
const LEADER_OVERVIEW_ROLES = new Set([
  ROLES.FACULTY_MANAGER,
  ROLES.DEPUTY_FACULTY_MANAGER,
  ROLES.DEPARTMENT_CHAIR,
  ROLES.DEPUTY_DEPARTMENT_CHAIR,
  ROLES.FACULTY_ASSISTANT,
]);

const ASSISTANT_DUE_SOON_MS = 2 * 24 * 60 * 60 * 1000;

export const isLeaderOverviewRole = (role) => LEADER_OVERVIEW_ROLES.has(role);
export { isAssistantOverviewRole, isAssistantRole };

/** JWT chỉ có id/email/role — tải đủ org để lọc khoa/bộ môn/cố vấn */
const loadStaffUser = async (userLike) => {
  const id = userLike?.id || userLike?._id;
  if (!id) return null;
  const staff = await User.findById(id).select(STAFF_SCOPE_SELECT);
  if (!staff || staff.isActive === false) return null;
  return staff;
};

/** Đồng bộ khoa/bộ môn/lớp từ hồ sơ SinhVien lên User trước khi chạy quy trình */
const ensureSubmitterOrgSynced = async (userId) => {
  if (!userId) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  return ensureStudentUserLinked(user);
};

const stepTargetKey = (step) => {
  const role = step?.role || '';
  if (isWorkflowOfficeUnitRole(role)) {
    const dept = String(step?.assigneeDepartment || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
    return `${role}::${dept}`;
  }
  return role;
};

const normalizeAssigneeDepartment = (step) => {
  if (!isWorkflowOfficeUnitRole(step?.role)) return null;
  const dept = String(step?.assigneeDepartment || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!dept) {
    const roleLabel = ROLE_LABELS[step.role] || step.role;
    throw new ValidationError(
      `Bước «${roleLabel}» cần chọn phòng hoặc trung tâm cụ thể trong hệ thống`,
    );
  }
  return dept;
};

const buildStepName = (step, roleLabel, assigneeDepartment) => {
  const custom = step.stepName?.trim();
  if (custom && (!assigneeDepartment || custom.includes(assigneeDepartment))) {
    return custom;
  }
  if (assigneeDepartment) {
    return `${roleLabel} — ${assigneeDepartment}`;
  }
  return custom || roleLabel;
};

const normalizeSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError('Quy trình phải có ít nhất một bước duyệt');
  }

  const allowedRoles = new Set(WORKFLOW_APPROVER_ROLES.map((r) => r.value));
  // fromRole bước 1 = Sinh viên (người nộp) — không phải bước duyệt
  const allowedFromRoles = new Set([...allowedRoles, 'student']);

  const sanitized = steps.filter((step) => step?.role && step.role !== 'student');
  if (!sanitized.length) {
    throw new ValidationError(
      'Quy trình phải có ít nhất một bước duyệt (không dùng vai trò Sinh viên làm bước xử lý)',
    );
  }
  if (sanitized.length !== steps.length) {
    // Bỏ bước Sinh viên thừa — SV ký/nộp ngoài chuỗi duyệt
  }

  const targetKeys = sanitized.map((step) => stepTargetKey(step));
  if (new Set(targetKeys).size !== targetKeys.length) {
    throw new ValidationError(
      'Mỗi cặp vai trò đích + đơn vị chỉ được dùng một lần trong quy trình',
    );
  }

  return sanitized.map((step, index) => {
    if (!allowedRoles.has(step.role) || step.role === 'student') {
      throw new ValidationError(
        step.role === 'student'
          ? 'Không dùng Sinh viên làm bước duyệt — SV chỉ nộp/ký trên form'
          : `Vai trò không hợp lệ: ${step.role}`,
      );
    }
    const fromRole = index === 0 ? 'student' : sanitized[index - 1].role;
    if (fromRole && !allowedFromRoles.has(fromRole)) {
      throw new ValidationError(`Vai trò nguồn không hợp lệ: ${fromRole}`);
    }
    const assigneeDepartment = normalizeAssigneeDepartment(step);
    if (fromRole && fromRole === step.role) {
      if (!isWorkflowOfficeUnitRole(step.role)) {
        throw new ValidationError('Vai trò nguồn và vai trò đích trong một bước phải khác nhau');
      }
      const prevDept =
        index === 0
          ? null
          : String(sanitized[index - 1].assigneeDepartment || '')
              .trim()
              .replace(/\s+/g, ' ')
              .toLowerCase();
      const currDept = String(assigneeDepartment || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();
      if (prevDept && currDept && prevDept === currDept) {
        throw new ValidationError(
          'Hai bước liên tiếp không thể cùng vai trò và cùng phòng/trung tâm',
        );
      }
    }
    const label = WORKFLOW_APPROVER_ROLES.find((r) => r.value === step.role)?.label;
    const deadlineDays = normalizeDeadlineDays(step.deadlineDays);
    return {
      stepOrder: index + 1,
      stepName: buildStepName(step, label, assigneeDepartment),
      role: step.role,
      fromRole: fromRole || null,
      assigneeDepartment,
      action: step.action || 'approve',
      isRequired: step.isRequired !== false,
      allowReject: step.allowReject !== false,
      allowReturn: step.allowReturn !== false,
      allowSign: step.allowSign !== false,
      requiresSignature: step.requiresSignature === true,
      returnTo: step.returnTo === 'previous' ? 'previous' : 'student',
      deadlineDays,
    };
  });
};

/** Workflow gắn riêng mẫu đơn — phải có ít nhất 1 bước ký/duyệt. */
const findFormOwnedWorkflow = async (loaiDonId) => {
  if (!loaiDonId) return null;
  const loaiDon = await workflowRepository.findLoaiDonById(loaiDonId);
  let workflow = null;
  if (loaiDon?.workflowId) {
    workflow = await workflowRepository.findWorkflowById(loaiDon.workflowId);
  }
  if (!workflow?.steps?.length) {
    workflow = await workflowRepository.findWorkflowByLoaiDonId(loaiDonId);
  }
  if (!workflow?.steps?.length) return null;
  return workflow;
};

export const getDefaultWorkflow = async () => {
  let workflow = await workflowRepository.findDefaultWorkflow();
  if (!workflow) {
    workflow = await workflowRepository.createWorkflow({
      name: 'Quy trình mặc định',
      isDefault: true,
      isActive: true,
      steps: DEFAULT_WORKFLOW_STEPS,
    });
  }
  return workflow;
};

export const updateDefaultWorkflow = async (steps) => {
  const workflow = await getDefaultWorkflow();
  workflow.steps = normalizeSteps(steps);
  await workflow.save();
  return workflow;
};

/**
 * Lấy quy trình của mẫu đơn.
 * Không fallback im lặng sang quy trình mặc định 3 bước.
 */
export const resolveWorkflowForLoaiDon = async (loaiDonId) => {
  if (!loaiDonId) {
    throw new ValidationError(
      'Hồ sơ thiếu mẫu đơn — không xác định được quy trình phê duyệt',
    );
  }

  const owned = await findFormOwnedWorkflow(loaiDonId);
  if (owned) return owned;

  throw new ValidationError(
    'Mẫu đơn chưa cấu hình quy trình riêng. Vào «Cấu hình quy trình» để thêm ít nhất một bước ký/duyệt.',
  );
};

const assertCanHandle = async (workflow, instance, userLike) => {
  if (instance.status === 'cancelled') {
    throw new ForbiddenError('Hồ sơ đã được sinh viên hủy, không thể xử lý tiếp');
  }
  if (instance.status === 'completed') {
    throw new ForbiddenError('Hồ sơ đã hoàn tất, không thể xử lý tiếp');
  }
  if (instance.status === 'rejected') {
    throw new ForbiddenError('Hồ sơ đã bị từ chối, không thể xử lý tiếp');
  }

  const user = await loadStaffUser(userLike);
  if (!user) {
    throw new ForbiddenError('Không xác định được tài khoản xử lý');
  }

  const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
  if (!currentStep) {
    throw new ValidationError('Không xác định được bước quy trình hiện tại');
  }

  let file = instance.generatedFileId;
  if (!file || typeof file !== 'object' || !file.submittedBy || typeof file.submittedBy !== 'object') {
    const fileId = file?._id || file || instance.generatedFileId;
    file = await GeneratedFile.findById(fileId).populate(
      'submittedBy',
      'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
    );
  }

  if (file?.trangThai === 'da_huy') {
    throw new ForbiddenError('Hồ sơ đã được sinh viên hủy, không thể xử lý tiếp');
  }
  if (file?.trangThai === 'da_duyet') {
    throw new ForbiddenError('Hồ sơ đã hoàn tất, không thể xử lý tiếp');
  }

  if (!(await userCanHandleWorkflowStep(user, currentStep, file))) {
    throw new ForbiddenError('Bạn không có quyền xử lý bước này trong quy trình');
  }

  if (!(await isSubmissionInApproverScope(user, file, currentStep))) {
    throw new ForbiddenError('Hồ sơ này không thuộc phạm vi khoa/bộ môn/đơn vị của bạn');
  }

  return currentStep;
};

export const startWorkflowForGeneratedFile = async (generatedFileId, userId, options = {}) => {
  // [SHARED-BE] Khởi chạy quy trình theo mẫu đơn (admin set) khi sinh viên gửi đơn
  const existing = await workflowRepository.findInstanceByGeneratedFile(generatedFileId);
  if (existing) return existing;

  // Đồng bộ khoa / bộ môn / lớp cố vấn từ hồ sơ SV → User trước khi định tuyến
  if (!options.skipOrgSync) {
    await ensureSubmitterOrgSynced(userId);
  }

  const file = options.generatedFile || (await GeneratedFile.findById(generatedFileId));
  const workflow =
    options.workflow || (await resolveWorkflowForLoaiDon(file?.loaiDonId || options.loaiDonId));

  if (!workflow?.steps?.length) {
    throw new ValidationError('Chưa cấu hình quy trình phê duyệt');
  }

  const now = new Date();

  const instance = await workflowRepository.createInstance({
    generatedFileId,
    workflowId: workflow._id,
    currentStepOrder: 1,
    status: 'in_progress',
    startedAt: now,
    currentStepEnteredAt: now,
  });

  await workflowRepository.updateGeneratedFileStatus(generatedFileId, 'cho_duyet', {
    submittedBy: userId,
    currentStepOrder: 1,
    workflowInstanceId: instance._id,
  });

  workflowEmail.queueSubmissionCreated(instance, workflow, userId);

  return instance;
};

const OPEN_SUBMISSION_STATUSES = ['cho_duyet', 'tre_han'];

/** Chặn nộp thêm khi cùng loại đơn đang trong quy trình. */
export const assertNoDuplicateOpenSubmission = async (userId, loaiDonId) => {
  if (!userId || !loaiDonId) return;
  const open = await GeneratedFile.findOne({
    submittedBy: userId,
    loaiDonId,
    trangThai: { $in: OPEN_SUBMISSION_STATUSES },
  })
    .select('_id')
    .lean();
  if (open) {
    throw new ValidationError(
      'Bạn đang có đơn này trong quá trình xử lý. Không nộp trùng. Hãy theo dõi tại Hồ sơ của tôi.',
    );
  }
};

/** Hồ sơ đã trả về (nháp) để sinh viên gửi lại trên cùng mã. */
export const findReturnedSubmission = async (userId, loaiDonId) => {
  if (!userId || !loaiDonId) return null;
  return GeneratedFile.findOne({
    submittedBy: userId,
    loaiDonId,
    trangThai: 'nhap',
  }).sort({ updatedAt: -1 });
};

/** Đưa hồ sơ trả về quay lại bước 1, giữ nguyên mã hồ sơ. */
export const resumeReturnedSubmission = async (generatedFileId, userId) => {
  const instance = await workflowRepository.findInstanceByGeneratedFile(generatedFileId);
  if (!instance) {
    return startWorkflowForGeneratedFile(generatedFileId, userId);
  }

  const now = new Date();
  instance.currentStepOrder = 1;
  instance.status = 'in_progress';
  instance.currentStepEnteredAt = now;
  instance.completedAt = null;
  instance.steps.push({
    stepOrder: 0,
    stepName: 'Sinh viên',
    assignedRole: 'student',
    handledBy: userId,
    action: 'resubmitted',
    comment: 'Sinh viên gửi lại hồ sơ sau khi được trả về',
    handledAt: now,
  });
  await instance.save();

  await workflowRepository.updateGeneratedFileStatus(generatedFileId, 'cho_duyet', {
    submittedBy: userId,
    currentStepOrder: 1,
    workflowInstanceId: instance._id,
  });

  const workflow =
    instance.workflowId && typeof instance.workflowId === 'object' && instance.workflowId.steps
      ? instance.workflowId
      : await workflowRepository.findWorkflowById(instance.workflowId);
  if (workflow) {
    workflowEmail.queueSubmissionCreated(instance, workflow, userId);
  }

  return instance;
};

/** Nhãn bước duyệt hiện tại (sau khi nộp) — dùng cho toast FE sinh viên. */
export const describeCurrentApproverStep = async (instance) => {
  if (!instance) return null;
  const workflow =
    instance.workflowId && typeof instance.workflowId === 'object' && instance.workflowId.steps
      ? instance.workflowId
      : await workflowRepository.findWorkflowById(instance.workflowId);
  const step = getCurrentStepDef(workflow, instance.currentStepOrder);
  if (!step) return null;
  return {
    stepOrder: instance.currentStepOrder,
    stepName: step.stepName || ROLE_LABELS[step.role] || step.role || '',
    role: step.role || '',
  };
};

const mapInstanceToTask = (instance, workflow) => {
  const file = instance.generatedFileId;
  const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
  const deadlineAt = getStepDeadlineAt(instance, currentStep);
  const isOverdue =
    instance.status === 'overdue' ||
    file?.trangThai === 'tre_han' ||
    (deadlineAt && Date.now() > deadlineAt.getTime());

  let daysRemaining = null;
  if (deadlineAt) {
    const DAY_MS = 24 * 60 * 60 * 1000;
    daysRemaining = Math.ceil((deadlineAt.getTime() - Date.now()) / DAY_MS);
  }

  if (file) {
    return {
      _id: instance._id,
      submissionId: String(file._id),
      submissionCode: String(file._id).slice(-6).toUpperCase(),
      formName: file.tenDon,
      submittedBy: file.tenNguoiGui,
      fileUrl: file.duongDanFile,
      fileMimeType: file.fileMimeType,
      currentStep: currentStep?.stepName || `Bước ${instance.currentStepOrder}`,
      currentStepRole: currentStep?.role,
      currentStepAction: currentStep?.action || 'approve',
      requiresSignature: currentStep?.requiresSignature === true,
      allowSign: currentStep?.allowSign !== false,
      allowReject: currentStep?.allowReject !== false,
      allowReturn: currentStep?.allowReturn !== false,
      returnTo: currentStep?.returnTo === 'previous' ? 'previous' : 'student',
      submittedAt: file.createdAt,
      deadlineDays: currentStep?.deadlineDays ?? null,
      deadlineAt: deadlineAt || null,
      daysRemaining,
      isOverdue: Boolean(isOverdue),
      instanceStatus: instance.status,
      trangThai: file.trangThai,
    };
  }

  return null;
};

export const getPendingTasks = async (userLike) => {
  const user = await loadStaffUser(userLike);
  if (!user) return [];

  const instances = await workflowRepository.findActiveInstances();
  const tasks = [];

  for (const instance of instances) {
    const workflow = instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
    if (!workflow) continue;

    await applyOverdueIfNeeded(instance, workflow);

    const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
    if (!currentStep) continue;

    const file = instance.generatedFileId;
    if (!(await userCanHandleWorkflowStep(user, currentStep, file))) continue;
    if (!(await isSubmissionInApproverScope(user, file, currentStep))) continue;

    const task = mapInstanceToTask(instance, workflow);
    if (task) tasks.push(task);
  }

  return tasks;
};

/**
 * Overview đơn trong phạm vi khoa/bộ môn cho trưởng khoa / trưởng bộ môn:
 * đang xử lý (kèm bước hiện tại), trễ hạn, đã hủy.
 * Không yêu cầu bước hiện tại phải khớp role của họ.
 */
export const getScopedOverviewForLeader = async (userLike) => {
  const user = await loadStaffUser(userLike);
  if (!user || !isLeaderOverviewRole(user.role)) return [];

  const instances = await workflowRepository.findLeaderOverviewInstances();
  const items = [];

  for (const instance of instances) {
    const workflow = instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
    if (!workflow) continue;

    const file = instance.generatedFileId;
    if (!file) continue;

    // Chỉ đơn thuộc đúng khoa / bộ môn của lãnh đạo
    if (!(await isSubmissionInApproverScope(user, file))) continue;

    if (instance.status !== 'cancelled') {
      await applyOverdueIfNeeded(instance, workflow);
    }

    const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
    const deadlineAt = getStepDeadlineAt(instance, currentStep);
    const isOverdue =
      instance.status === 'overdue' ||
      file?.trangThai === 'tre_han' ||
      (deadlineAt &&
        ['pending', 'in_progress', 'overdue'].includes(instance.status) &&
        Date.now() > deadlineAt.getTime());

    let kind = 'in_progress';
    if (instance.status === 'cancelled' || file.trangThai === 'da_huy') {
      kind = 'cancelled';
    } else if (isOverdue) {
      kind = 'overdue';
    }

    const currentStepName =
      kind === 'cancelled'
        ? ''
        : currentStep?.stepName || ROLE_LABELS[currentStep?.role] || currentStep?.role || '';

    items.push({
      submissionId: String(file._id),
      submissionCode: String(file._id).slice(-6).toUpperCase(),
      formName: file.tenDon,
      submittedBy: file.tenNguoiGui || file.submittedBy?.fullName || 'Sinh viên',
      kind,
      instanceStatus: instance.status,
      trangThai: file.trangThai,
      currentStep: currentStepName,
      currentStepRole: currentStep?.role || null,
      cancelReason: file.cancelReason || '',
      updatedAt: instance.updatedAt || file.updatedAt || file.createdAt,
      isOverdue: kind === 'overdue',
    });
  }

  // Ưu tiên: trễ hạn → đang xử lý → đã hủy; trong nhóm theo updatedAt mới nhất
  const kindOrder = { overdue: 0, in_progress: 1, cancelled: 2 };
  items.sort((a, b) => {
    const ko = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
    if (ko !== 0) return ko;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return items.slice(0, 80);
};

/**
 * Theo dõi đơn đơn vị cho trợ lý (chỉ đọc): chờ trưởng / quá hạn / sắp quá hạn / đã hoàn tất.
 * @param {string} [filter] waiting_leader | overdue | due_soon | completed | all
 */
export const getAssistantMonitor = async (userLike, filter = 'all') => {
  const user = await loadStaffUser(userLike);
  if (!user || !isAssistantOverviewRole(user.role)) {
    throw new ForbiddenError('Chỉ trợ lý khoa / phòng / trung tâm được xem danh sách theo dõi');
  }

  const instances = await workflowRepository.findAssistantMonitorInstances();
  const items = [];
  const now = Date.now();

  for (const instance of instances) {
    const workflow = instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
    if (!workflow) continue;
    const file = instance.generatedFileId;
    if (!file) continue;

    if (!(await isSubmissionInAssistantUnitScope(user, file, workflow))) continue;

    if (['pending', 'in_progress', 'overdue'].includes(instance.status)) {
      await applyOverdueIfNeeded(instance, workflow);
    }

    const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
    const deadlineAt = getStepDeadlineAt(instance, currentStep);
    const waitingLeader = isWaitingLeaderStepForAssistant(user, currentStep);
    const isActive = ['pending', 'in_progress', 'overdue'].includes(instance.status);
    const isOverdue =
      isActive &&
      (instance.status === 'overdue' ||
        file?.trangThai === 'tre_han' ||
        (deadlineAt && now > deadlineAt.getTime()));
    const isDueSoon =
      isActive &&
      waitingLeader &&
      !isOverdue &&
      deadlineAt &&
      deadlineAt.getTime() - now <= ASSISTANT_DUE_SOON_MS &&
      deadlineAt.getTime() > now;
    const isCompleted =
      instance.status === 'completed' ||
      file?.trangThai === 'da_duyet' ||
      instance.status === 'rejected';

    let kind = 'in_progress';
    if (instance.status === 'cancelled' || file.trangThai === 'da_huy') kind = 'cancelled';
    else if (isCompleted) kind = 'completed';
    else if (isOverdue) kind = 'overdue';
    else if (isDueSoon) kind = 'due_soon';
    else if (waitingLeader) kind = 'waiting_leader';

    const item = {
      submissionId: String(file._id),
      submissionCode: String(file._id).slice(-6).toUpperCase(),
      formName: file.tenDon,
      submittedBy: file.tenNguoiGui || file.submittedBy?.fullName || 'Sinh viên',
      fileUrl: file.duongDanFile || '',
      kind,
      instanceStatus: instance.status,
      trangThai: file.trangThai,
      currentStep:
        kind === 'cancelled' || kind === 'completed'
          ? kind === 'completed'
            ? 'Đã hoàn tất'
            : ''
          : currentStep?.stepName || ROLE_LABELS[currentStep?.role] || currentStep?.role || '',
      currentStepRole: currentStep?.role || null,
      deadlineAt: deadlineAt || null,
      waitingLeader,
      isOverdue: Boolean(isOverdue),
      isDueSoon: Boolean(isDueSoon),
      updatedAt: instance.updatedAt || file.updatedAt || file.createdAt,
      completedAt: instance.completedAt || null,
      canPrint: Boolean(file.duongDanFile),
      canSign: false,
    };

    const f = String(filter || 'all');
    if (f === 'waiting_leader' && kind !== 'waiting_leader' && kind !== 'due_soon' && kind !== 'overdue') {
      if (!(waitingLeader && isActive)) continue;
    }
    if (f === 'overdue' && !isOverdue) continue;
    if (f === 'due_soon' && !isDueSoon) continue;
    if (f === 'completed' && kind !== 'completed') continue;
    if (f === 'all') {
      // keep
    }

    items.push(item);
  }

  const kindOrder = {
    overdue: 0,
    due_soon: 1,
    waiting_leader: 2,
    in_progress: 3,
    completed: 4,
    cancelled: 5,
  };
  items.sort((a, b) => {
    const ko = (kindOrder[a.kind] ?? 9) - (kindOrder[b.kind] ?? 9);
    if (ko !== 0) return ko;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return items.slice(0, 150);
};

/** Thống kê dashboard cho trợ lý — phục vụ nhắc trưởng ký */
export const getAssistantDashboardStats = async (userLike) => {
  const items = await getAssistantMonitor(userLike, 'all');
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const waitingLeader = items.filter(
    (i) => i.waitingLeader && ['waiting_leader', 'due_soon', 'overdue', 'in_progress'].includes(i.kind),
  ).length;
  const overdue = items.filter((i) => i.isOverdue).length;
  const dueSoon = items.filter((i) => i.isDueSoon).length;
  const completedThisMonth = items.filter((i) => {
    if (i.kind !== 'completed') return false;
    const at = i.completedAt || i.updatedAt;
    return at && new Date(at) >= monthStart;
  }).length;

  const remindList = items
    .filter((i) => i.isOverdue || i.isDueSoon || i.kind === 'waiting_leader')
    .slice(0, 8);

  return {
    waitingLeader,
    overdue,
    dueSoon,
    completedThisMonth,
    totalInScope: items.length,
    remindList,
  };
};

const PROCEDURE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

/**
 * Báo cáo thống kê theo phạm vi đơn vị trợ lý (khoa / phòng / trung tâm).
 * @param {{ from?: string, to?: string }} [query]
 */
export const getAssistantUnitReport = async (userLike, query = {}) => {
  const user = await loadStaffUser(userLike);
  if (!user || !isAssistantOverviewRole(user.role)) {
    throw new ForbiddenError('Chỉ trợ lý khoa / phòng / trung tâm được xem thống kê đơn vị');
  }

  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  const fromOk = from && !Number.isNaN(from.getTime()) ? from : null;
  const toOk = to && !Number.isNaN(to.getTime()) ? to : null;

  let items = await getAssistantMonitor(user, 'all');
  if (fromOk || toOk) {
    items = items.filter((item) => {
      const at = new Date(item.completedAt || item.updatedAt || 0);
      if (Number.isNaN(at.getTime())) return false;
      if (fromOk && at < fromOk) return false;
      if (toOk && at > toOk) return false;
      return true;
    });
  }

  const waitingLeader = items.filter(
    (i) =>
      i.waitingLeader ||
      i.kind === 'waiting_leader' ||
      i.kind === 'due_soon' ||
      i.kind === 'overdue',
  ).length;
  const overdue = items.filter((i) => i.isOverdue || i.kind === 'overdue').length;
  const dueSoon = items.filter((i) => i.isDueSoon || i.kind === 'due_soon').length;
  const completed = items.filter((i) => i.kind === 'completed').length;
  const cancelled = items.filter((i) => i.kind === 'cancelled').length;
  const inProgress = items.filter((i) => i.kind === 'in_progress').length;
  const total = items.length;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  const overdueRate = total > 0 ? Math.round((overdue / total) * 1000) / 10 : 0;

  const byStatus = [
    { status: 'waiting_leader', label: 'Chờ trưởng ký', count: waitingLeader },
    { status: 'overdue', label: 'Quá hạn', count: overdue },
    { status: 'due_soon', label: 'Sắp quá hạn', count: dueSoon },
    { status: 'in_progress', label: 'Đang xử lý', count: inProgress },
    { status: 'completed', label: 'Đã hoàn tất', count: completed },
    { status: 'cancelled', label: 'Đã hủy', count: cancelled },
  ].filter((row) => row.count > 0 || ['waiting_leader', 'overdue', 'completed'].includes(row.status));

  const procedureMap = new Map();
  for (const item of items) {
    const name = item.formName || 'Không rõ';
    if (!procedureMap.has(name)) {
      procedureMap.set(name, { name, value: 0, completed: 0, overdue: 0, waitingLeader: 0 });
    }
    const row = procedureMap.get(name);
    row.value += 1;
    if (item.kind === 'completed') row.completed += 1;
    if (item.isOverdue || item.kind === 'overdue') row.overdue += 1;
    if (item.waitingLeader || item.kind === 'waiting_leader' || item.kind === 'due_soon') {
      row.waitingLeader += 1;
    }
  }
  const byProcedure = [...procedureMap.values()]
    .map((row, index) => ({
      ...row,
      percentage: row.value > 0 ? Math.round((row.completed / row.value) * 1000) / 10 : 0,
      color: PROCEDURE_COLORS[index % PROCEDURE_COLORS.length],
    }))
    .sort((a, b) => b.value - a.value);

  const monthMap = new Map();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, {
      month: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`,
      key,
      requests: 0,
      completed: 0,
      overdue: 0,
    });
  }
  for (const item of items) {
    const at = new Date(item.completedAt || item.updatedAt || 0);
    if (Number.isNaN(at.getTime())) continue;
    const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key);
    if (!bucket) continue;
    bucket.requests += 1;
    if (item.kind === 'completed') bucket.completed += 1;
    if (item.isOverdue || item.kind === 'overdue') bucket.overdue += 1;
  }
  const monthly = [...monthMap.values()].map(({ key: _k, ...rest }) => rest);

  const topRemind = items
    .filter((i) => i.isOverdue || i.isDueSoon || i.kind === 'waiting_leader')
    .slice(0, 12)
    .map((i) => ({
      submissionId: i.submissionId,
      submissionCode: i.submissionCode,
      formName: i.formName,
      submittedBy: i.submittedBy,
      kind: i.kind,
      currentStep: i.currentStep,
      deadlineAt: i.deadlineAt,
      updatedAt: i.updatedAt,
    }));

  const scopeLabel =
    user.role === ROLES.KHOA_ASSISTANT
      ? user.faculty || 'Theo khoa được gán'
      : user.department || 'Theo phòng/trung tâm được gán';

  return {
    mode: 'assistant',
    scopeLabel,
    role: user.role,
    summary: {
      total,
      waitingLeader,
      overdue,
      dueSoon,
      inProgress,
      completed,
      cancelled,
      completionRate,
      overdueRate,
    },
    byStatus,
    byProcedure,
    monthly,
    topRemind,
    range: {
      from: fromOk ? fromOk.toISOString() : null,
      to: toOk ? toOk.toISOString() : null,
    },
  };
};

export const exportAssistantUnitReport = async (userLike, query = {}) => {
  const stats = await getAssistantUnitReport(userLike, query);
  const lines = [
    'Loại,Chỉ số,Giá trị',
    `Phạm vi,Đơn vị,${stats.scopeLabel}`,
    `Tổng quan,Tổng hồ sơ,${stats.summary.total}`,
    `Tổng quan,Chờ trưởng ký,${stats.summary.waitingLeader}`,
    `Tổng quan,Quá hạn,${stats.summary.overdue}`,
    `Tổng quan,Sắp quá hạn,${stats.summary.dueSoon}`,
    `Tổng quan,Đang xử lý,${stats.summary.inProgress}`,
    `Tổng quan,Đã hoàn tất,${stats.summary.completed}`,
    `Tổng quan,Đã hủy,${stats.summary.cancelled}`,
    `Tổng quan,Tỷ lệ hoàn tất (%),${stats.summary.completionRate}`,
    `Tổng quan,Tỷ lệ quá hạn (%),${stats.summary.overdueRate}`,
    '',
    'Trạng thái,Số lượng',
    ...stats.byStatus.map((s) => `${s.label},${s.count}`),
    '',
    'Thủ tục,Tổng,Hoàn tất,Quá hạn,Chờ trưởng,Tỷ lệ hoàn tất (%)',
    ...stats.byProcedure.map(
      (p) =>
        `${String(p.name).replace(/"/g, '""')},${p.value},${p.completed},${p.overdue},${p.waitingLeader},${p.percentage}`,
    ),
    '',
    'Tháng,Trong phạm vi,Hoàn tất,Quá hạn',
    ...stats.monthly.map((m) => `${m.month},${m.requests},${m.completed},${m.overdue}`),
  ];
  return `\uFEFF${lines.join('\n')}`;
};

const ACTION_LABELS = {
  approved: 'Đã duyệt',
  signed: 'Đã ký số',
  hand_signed: 'Đã ký tay',
  rejected: 'Đã từ chối',
  returned: 'Đã trả về',
  withdrawn: 'SV đã hủy',
};

export const getProcessedTasks = async (user) => {
  const instances = await workflowRepository.findInstancesHandledByUser(user.id);
  const tasks = [];
  const seen = new Set();

  for (const instance of instances) {
    const workflow = instance.workflowId;
    if (!workflow) continue;

    const mySteps = instance.steps
      .filter((s) => s.handledBy?.toString() === user.id)
      .sort((a, b) => new Date(b.handledAt) - new Date(a.handledAt));

    const latest = mySteps[0];
    if (!latest) continue;

    const dedupeKey = String(instance._id);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const base = mapInstanceToTask(instance, workflow);
    if (!base) continue;

    tasks.push({
      ...base,
      myAction: ACTION_LABELS[latest.action] || latest.action,
      myActionAt: latest.handledAt,
      instanceStatus: instance.status,
    });
  }

  return tasks;
};

const resolveInstance = async (fileOrSubmissionId) => {
  let instance = await workflowRepository.findInstanceByGeneratedFile(fileOrSubmissionId);
  if (!instance) {
    instance = await workflowRepository.findInstanceById(fileOrSubmissionId);
  }
  if (!instance) throw new NotFoundError('Không tìm thấy quy trình cho hồ sơ này');
  return instance;
};

const BULK_MAX_ITEMS = 50;

/**
 * Duyệt / ký / từ chối hàng loạt — gọi tuần tự approve/reject từng hồ sơ.
 * Trả về { success[], failed[] } để FE hiện kết quả từng mã.
 */
export const bulkProcess = async (
  user,
  { submissionIds = [], action = 'approve', comment, signature } = {},
  auditContext = {},
) => {
  const ids = [...new Set((submissionIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!ids.length) {
    throw new ValidationError('Vui lòng chọn ít nhất một hồ sơ');
  }
  if (ids.length > BULK_MAX_ITEMS) {
    throw new ValidationError(`Mỗi lần xử lý tối đa ${BULK_MAX_ITEMS} hồ sơ`);
  }

  const processAction =
    action === 'handwritten' || action === 'sign' || action === 'reject' || action === 'approve'
      ? action
      : 'approve';

  const success = [];
  const failed = [];

  for (const id of ids) {
    try {
      if (processAction === 'reject') {
        await reject(id, user, { comment }, auditContext);
      } else {
        await approve(
          id,
          user,
          {
            comment,
            signature,
            action: processAction,
          },
          auditContext,
        );
      }
      success.push({ submissionId: id });
    } catch (err) {
      failed.push({
        submissionId: id,
        message: err?.message || 'Xử lý thất bại',
      });
    }
  }

  return {
    total: ids.length,
    successCount: success.length,
    failedCount: failed.length,
    success,
    failed,
  };
};

export const approve = async (
  fileOrSubmissionId,
  user,
  { comment, signature, action: requestedAction } = {},
  auditContext = {},
) => {
  const instance = await resolveInstance(fileOrSubmissionId);
  const workflow = instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
  if (!workflow) throw new NotFoundError('Workflow not found');

  const currentStep = await assertCanHandle(workflow, instance, user);

  // Hình thức xử lý do tài khoản nội bộ chọn (approve | sign | handwritten)
  const processAction =
    requestedAction === 'handwritten' ||
    requestedAction === 'sign' ||
    signature?.provider
      ? requestedAction === 'handwritten' || signature?.provider === 'handwritten'
        ? 'handwritten'
        : 'sign'
      : 'approve';

  let signatureResult = null;
  const requiresSignature = processAction === 'sign' || processAction === 'handwritten';

  if (currentStep.allowSign === false && requiresSignature) {
    throw new ValidationError('Bước này chỉ kiểm tra trên hệ thống, không ký lên đơn.');
  }
  if (currentStep.requiresSignature === true && !requiresSignature) {
    throw new ValidationError('Bước này phải ký lên đơn (ký số hoặc ký tay) trước khi hoàn tất.');
  }

  if (requiresSignature) {
    if (!signature?.provider) {
      throw new ValidationError(
        processAction === 'handwritten'
          ? 'Bạn đã chọn ký tay. Vui lòng vẽ chữ ký hoặc dùng ảnh chữ ký đã lưu.'
          : 'Bạn đã chọn ký số. Vui lòng chọn SmartCA hoặc USB Token và xác thực trước khi duyệt.',
      );
    }
    const { signSubmission } = await import('../signatures/signature.service.js');
    signatureResult = await signSubmission(fileOrSubmissionId, user, {
      ...signature,
      comment,
      skipAudit: true,
    });
  }

  instance.steps.push({
    stepOrder: instance.currentStepOrder,
    stepName: currentStep.stepName,
    assignedRole: currentStep.role,
    handledBy: user.id,
    action:
      processAction === 'handwritten'
        ? 'hand_signed'
        : processAction === 'sign'
          ? 'signed'
          : 'approved',
    comment,
    handledAt: new Date(),
    signatureId: signatureResult?.signature?._id || null,
  });

  const nextStep = getNextStep(workflow, instance, 'approve');

  if (nextStep) {
    const enteredAt = new Date();
    instance.currentStepOrder = nextStep.stepOrder;
    instance.currentStepEnteredAt = enteredAt;
    instance.status = 'in_progress';
    await instance.save();

    if (instance.generatedFileId) {
      await workflowRepository.updateGeneratedFileStatus(instance.generatedFileId, 'cho_duyet', {
        currentStepOrder: nextStep.stepOrder,
      });
    }

    workflowEmail.queueStepApproved({
      instance,
      workflow,
      actor: user,
      completedStep: currentStep,
      nextStepDef: nextStep.step,
      isFinal: false,
      comment,
    });
  } else {
    instance.status = 'completed';
    instance.completedAt = new Date();
    await instance.save();

    if (instance.generatedFileId) {
      await workflowRepository.updateGeneratedFileStatus(instance.generatedFileId, 'da_duyet', {
        currentStepOrder: instance.currentStepOrder,
      });
    }

    workflowEmail.queueStepApproved({
      instance,
      workflow,
      actor: user,
      completedStep: currentStep,
      nextStepDef: null,
      isFinal: true,
      comment,
    });
  }

  const fileId = instance.generatedFileId?._id || instance.generatedFileId;
  await writeAuditLog({
    userId: user.id,
    action:
      processAction === 'handwritten'
        ? 'workflow.hand_signed'
        : processAction === 'sign'
          ? 'workflow.signed'
          : 'workflow.approved',
    entityType: 'GeneratedFile',
    entityId: fileId,
    metadata: {
      stepOrder: currentStep.stepOrder,
      stepName: currentStep.stepName,
      role: currentStep.role,
      signatureId: signatureResult?.signature?._id || null,
      isMock: Boolean(signatureResult?.isMock),
    },
    ...auditContext,
  });

  return { instance, signature: signatureResult };
};

export const reject = async (fileOrSubmissionId, user, { comment } = {}, auditContext = {}) => {
  const instance = await resolveInstance(fileOrSubmissionId);
  const workflow = instance.workflowId;
  const currentStep = await assertCanHandle(workflow, instance, user);
  if (currentStep.allowReject === false) {
    throw new ValidationError('Bước này không từ chối hồ sơ. Hãy trả hồ sơ kèm lý do để chỉnh sửa.');
  }

  instance.status = 'rejected';
  instance.steps.push({
    stepOrder: instance.currentStepOrder,
    stepName: currentStep.stepName,
    assignedRole: currentStep.role,
    handledBy: user.id,
    action: 'rejected',
    comment,
    handledAt: new Date(),
  });

  await instance.save();

  if (instance.generatedFileId) {
    await workflowRepository.updateGeneratedFileStatus(instance.generatedFileId, 'tu_choi');
  }

  workflowEmail.queueRejected({
    instance,
    actor: user,
    completedStep: currentStep,
    comment,
  });

  await writeAuditLog({
    userId: user.id,
    action: 'workflow.rejected',
    entityType: 'GeneratedFile',
    entityId: instance.generatedFileId?._id || instance.generatedFileId,
    metadata: {
      stepOrder: currentStep.stepOrder,
      stepName: currentStep.stepName,
      role: currentStep.role,
      comment: String(comment || '').slice(0, 500),
    },
    ...auditContext,
  });

  return instance;
};

export const returnToStudent = async (fileOrSubmissionId, user, { comment } = {}, auditContext = {}) => {
  const reason = String(comment || '').trim();
  if (reason.length < 5) {
    throw new ValidationError('Vui lòng nhập lý do trả hồ sơ (ít nhất 5 ký tự)');
  }
  if (reason.length > 500) {
    throw new ValidationError('Lý do trả hồ sơ tối đa 500 ký tự');
  }

  const instance = await resolveInstance(fileOrSubmissionId);
  const workflow = instance.workflowId;
  const currentStep = await assertCanHandle(workflow, instance, user);
  const returnToPrevious = currentStep.returnTo === 'previous' && instance.currentStepOrder > 1;
  const previousStep = returnToPrevious
    ? getCurrentStepDef(workflow, instance.currentStepOrder - 1)
    : null;

  instance.steps.push({
    stepOrder: currentStep.stepOrder,
    stepName: currentStep.stepName,
    assignedRole: currentStep.role,
    handledBy: user.id,
    action: 'returned',
    comment: reason,
    handledAt: new Date(),
  });

  if (previousStep) {
    instance.currentStepOrder = previousStep.stepOrder;
    instance.currentStepEnteredAt = new Date();
    instance.status = 'in_progress';
    await instance.save();

    if (instance.generatedFileId) {
      await workflowRepository.updateGeneratedFileStatus(instance.generatedFileId, 'cho_duyet', {
        currentStepOrder: previousStep.stepOrder,
      });
    }

    workflowEmail.queueReturnedToPrevious({
      instance,
      actor: user,
      completedStep: currentStep,
      previousStep,
      comment: reason,
    });
  } else {
    instance.currentStepOrder = 0;
    instance.status = 'pending';
    await instance.save();

    if (instance.generatedFileId) {
      await workflowRepository.updateGeneratedFileStatus(instance.generatedFileId, 'nhap', {
        currentStepOrder: 0,
      });
    }

    workflowEmail.queueReturned({
      instance,
      actor: user,
      completedStep: currentStep,
      comment: reason,
    });
  }

  await writeAuditLog({
    userId: user.id,
    action: 'workflow.returned',
    entityType: 'GeneratedFile',
    entityId: instance.generatedFileId?._id || instance.generatedFileId,
    metadata: {
      stepOrder: currentStep.stepOrder,
      stepName: currentStep.stepName,
      role: currentStep.role,
      comment: reason,
      returnTo: previousStep ? 'previous' : 'student',
    },
    ...auditContext,
  });

  return instance;
};

/**
 * Sinh viên rút đơn đang trong quy trình (chưa hoàn tất).
 * Bắt buộc lý do. Không cho rút khi đã hoàn tất / từ chối / đã rút.
 */
export const cancelByStudent = async (fileOrSubmissionId, user, { reason, ipAddress, userAgent } = {}) => {
  const cancelReason = String(reason || '').trim();
  if (cancelReason.length < 5) {
    throw new ValidationError('Vui lòng nhập lý do rút đơn (ít nhất 5 ký tự)');
  }
  if (cancelReason.length > 500) {
    throw new ValidationError('Lý do rút đơn tối đa 500 ký tự');
  }

  if (!user?.id || user.role !== 'student') {
    throw new ForbiddenError('Chỉ sinh viên nộp đơn mới được rút hồ sơ này');
  }

  let file = await GeneratedFile.findById(fileOrSubmissionId);
  if (!file) {
    const byInstance = await workflowRepository.findInstanceById(fileOrSubmissionId);
    if (byInstance?.generatedFileId) {
      file = await GeneratedFile.findById(byInstance.generatedFileId);
    }
  }
  if (!file) throw new NotFoundError('Không tìm thấy hồ sơ');

  if (String(file.submittedBy) !== String(user.id)) {
    throw new ForbiddenError('Bạn không có quyền rút hồ sơ này');
  }

  if (file.trangThai === 'da_duyet') {
    throw new ForbiddenError('Hồ sơ đã hoàn tất, không thể rút');
  }
  if (file.trangThai === 'tu_choi') {
    throw new ForbiddenError('Hồ sơ đã bị từ chối, không thể rút');
  }
  if (file.trangThai === 'da_huy') {
    throw new ForbiddenError('Hồ sơ đã được rút trước đó');
  }
  if (!['cho_duyet', 'tre_han', 'nhap'].includes(file.trangThai)) {
    throw new ForbiddenError('Trạng thái hiện tại không cho phép rút đơn');
  }

  let instance = await workflowRepository.findInstanceByGeneratedFile(file._id);
  if (instance) {
    if (instance.status === 'completed') {
      throw new ForbiddenError('Hồ sơ đã hoàn tất, không thể rút');
    }
    if (instance.status === 'rejected') {
      throw new ForbiddenError('Hồ sơ đã bị từ chối, không thể rút');
    }
    if (instance.status === 'cancelled') {
      throw new ForbiddenError('Hồ sơ đã được rút trước đó');
    }

    const workflow =
      instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
    const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);

    instance.status = 'cancelled';
    instance.steps.push({
      stepOrder: instance.currentStepOrder || 0,
      stepName: 'Sinh viên',
      assignedRole: 'student',
      handledBy: user.id,
      action: 'withdrawn',
      comment: cancelReason,
      handledAt: new Date(),
    });
    await instance.save();

    const Signature = (await import('../signatures/signature.model.js')).default;
    await Signature.updateMany(
      {
        generatedFileId: file._id,
        status: { $in: ['pending', 'signed', 'verified'] },
      },
      {
        $set: {
          status: 'superseded',
          'meta.supersededReason': 'student_cancelled',
          'meta.supersededAt': new Date(),
        },
      },
    );

    workflowEmail.queueCancelled({
      instance,
      actor: user,
      currentStep,
      reason: cancelReason,
    });
  }

  const now = new Date();
  file.trangThai = 'da_huy';
  file.cancelReason = cancelReason;
  file.cancelledAt = now;
  await file.save();

  await writeAuditLog({
    userId: user.id,
    action: 'workflow.withdrawn',
    entityType: 'GeneratedFile',
    entityId: file._id,
    metadata: { comment: cancelReason.slice(0, 500) },
    ipAddress,
    userAgent,
  });

  return {
    file,
    instance,
    message: 'Đã rút hồ sơ thành công',
  };
};

export const getHistory = async (fileOrSubmissionId) => {
  const instance = await resolveInstance(fileOrSubmissionId);
  return instance.steps;
};

export const getApproverRoleOptions = async () => {
  const [phongUnits, trungTamUnits] = await Promise.all([
    listOfficeUnitsFromUsers('phong'),
    listOfficeUnitsFromUsers('trung_tam'),
  ]);

  return WORKFLOW_APPROVER_ROLES.map((role) => {
    if (!role.requiresUnit) {
      return { ...role, units: [] };
    }
    const units = role.unitKind === 'trung_tam' ? trungTamUnits : phongUnits;
    return {
      ...role,
      units: units
        .map((u) => ({
          value: u.value,
          label: u.label,
          holders: u.holders.filter((h) => h.role === role.value),
        }))
        .filter((u) => u.holders.length > 0),
    };
  });
};

export const listFormWorkflowConfigs = async () => {
  const [wordForms, defaultWorkflow] = await Promise.all([
    workflowRepository.findAllLoaiDon(),
    getDefaultWorkflow(),
  ]);

  return Promise.all(
    wordForms.map(async (form) => {
      const workflow = await findFormOwnedWorkflow(form._id);
      const hasCustomWorkflow = Boolean(workflow?.steps?.length);
      return {
        formType: 'word',
        formId: form._id,
        formName: form.tenDon,
        hasCustomWorkflow,
        stepsCount: hasCustomWorkflow
          ? workflow.steps.length
          : defaultWorkflow?.steps?.length || 0,
        sourceType: form.sourceType,
      };
    }),
  );
};

export const listFormApprovalSteps = async (formId) => {
  if (!/^[a-f\d]{24}$/i.test(String(formId || ''))) {
    throw new NotFoundError('Biểu mẫu không tồn tại');
  }

  const loaiDon = await workflowRepository.findLoaiDonById(formId);
  if (!loaiDon) throw new NotFoundError('Biểu mẫu không tồn tại');

  let workflow;
  try {
    workflow = await resolveWorkflowForLoaiDon(formId);
  } catch (error) {
    if (error instanceof ValidationError) return [];
    throw error;
  }

  return (workflow?.steps || [])
    .filter((step) => step?.role && step.role !== 'student')
    .map((step) => ({
      stepOrder: step.stepOrder,
      stepName: step.stepName || ROLE_LABELS[step.role] || step.role,
      role: step.role,
      roleLabel: ROLE_LABELS[step.role] || step.role,
    }));
};

export const getFormWorkflowConfig = async (formType, formId) => {
  if (formType !== 'word') {
    throw new ValidationError('Chỉ hỗ trợ cấu hình quy trình cho mẫu Word');
  }

  const defaultWorkflow = await getDefaultWorkflow();
  const loaiDon = await workflowRepository.findLoaiDonById(formId);
  if (!loaiDon) throw new NotFoundError('Biểu mẫu không tồn tại');

  const owned = await findFormOwnedWorkflow(formId);
  const isUsingDefault = !owned;
  const effectiveWorkflow = owned || defaultWorkflow;

  return {
    formType: 'word',
    formId: loaiDon._id,
    formName: loaiDon.tenDon,
    isUsingDefault,
    workflow: effectiveWorkflow,
  };
};

export const updateFormWorkflowConfig = async (formType, formId, steps) => {
  if (formType !== 'word') {
    throw new ValidationError('Chỉ hỗ trợ cấu hình quy trình cho mẫu Word');
  }

  const normalized = normalizeSteps(steps);
  const loaiDon = await workflowRepository.findLoaiDonById(formId);
  if (!loaiDon) throw new NotFoundError('Biểu mẫu không tồn tại');

  let workflow = loaiDon.workflowId
    ? await workflowRepository.findWorkflowById(loaiDon.workflowId)
    : null;
  if (!workflow) {
    workflow = await workflowRepository.findWorkflowByLoaiDonId(formId);
  }

  const workflowName = `Quy trình — ${loaiDon.tenDon}`;

  if (workflow) {
    workflow.steps = normalized;
    workflow.name = workflowName;
    await workflow.save();
    if (!loaiDon.workflowId || String(loaiDon.workflowId) !== String(workflow._id)) {
      await workflowRepository.updateLoaiDonWorkflow(loaiDon._id, workflow._id);
    }
  } else {
    workflow = await workflowRepository.createWorkflow({
      name: workflowName,
      loaiDonId: loaiDon._id,
      isDefault: false,
      isActive: true,
      steps: normalized,
    });
    await workflowRepository.updateLoaiDonWorkflow(loaiDon._id, workflow._id);
  }

  return getFormWorkflowConfig(formType, formId);
};
