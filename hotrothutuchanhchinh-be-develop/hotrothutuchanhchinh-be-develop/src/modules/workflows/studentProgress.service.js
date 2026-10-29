import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { WorkflowInstance } from './workflow.model.js';
import * as workflowRepository from './workflow.repository.js';
import { resolveWorkflowForLoaiDon } from './workflow.service.js';
import { WORKFLOW_APPROVER_ROLES } from './workflow.constants.js';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.js';
import { applyOverdueIfNeeded } from './workflowOverdue.service.js';
import { getStepDeadlineAt, getCurrentStepDef } from './engines/workflowEngine.js';

const ROLE_LABEL_MAP = Object.fromEntries(
  WORKFLOW_APPROVER_ROLES.map((r) => [r.value, r.label]),
);

const ACTION_MESSAGES = {
  approved: 'đã duyệt',
  signed: 'đã ký số',
  hand_signed: 'đã ký tay',
  rejected: 'đã từ chối',
  returned: 'đã trả về sinh viên chỉnh sửa',
  withdrawn: 'đã rút hồ sơ',
  resubmitted: 'nộp lại',
};

const formatDateTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN');
};

const getRoleLabel = (role) => ROLE_LABEL_MAP[role] || role || '';

const getStepIcon = (role, state) => {
  if (state === 'rejected') return 'fa-circle-xmark';
  if (state === 'withdrawn') return 'fa-ban';
  if (state === 'completed') return 'fa-circle-check';
  if (role === 'academic_advisor') return 'fa-user-graduate';
  if (role === 'department_chair') return 'fa-graduation-cap';
  if (role === 'faculty_manager' || role === 'department_head') return 'fa-building-columns';
  return 'fa-circle-chevron-right';
};

const buildStatusDisplay = (file, instance, currentStepName) => {
  if (file.trangThai === 'da_huy' || instance?.status === 'cancelled') {
    return 'Đã rút';
  }
  if (file.trangThai === 'da_duyet' || instance?.status === 'completed') {
    return 'Đã phê duyệt';
  }
  if (file.trangThai === 'tu_choi' || instance?.status === 'rejected') {
    return 'Bị từ chối';
  }
  if (file.trangThai === 'nhap') {
    return 'Cần chỉnh sửa';
  }
  if (file.trangThai === 'tre_han' || instance?.status === 'overdue') {
    return currentStepName ? `Đã trễ hạn — ${currentStepName}` : 'Đã trễ hạn';
  }
  if (file.trangThai === 'cho_duyet' && currentStepName) {
    return `Đang xử lý — ${currentStepName}`;
  }
  if (file.trangThai === 'cho_duyet') {
    return 'Đang xử lý';
  }
  return 'Chờ xử lý';
};

const buildStatusSummary = (file, instance, currentStepName) => {
  if (file.trangThai === 'da_huy' || instance?.status === 'cancelled') {
    const reason = file.cancelReason ? ` Lý do: ${file.cancelReason}` : '';
    return `Trạng thái hiện tại: Sinh viên đã rút hồ sơ.${reason}`;
  }
  if (file.trangThai === 'da_duyet' || instance?.status === 'completed') {
    return 'Trạng thái hiện tại: Đã hoàn thành thủ tục. Hồ sơ đã phê duyệt thành công.';
  }
  if (file.trangThai === 'tu_choi' || instance?.status === 'rejected') {
    return 'Trạng thái hiện tại: Hồ sơ đã bị từ chối. Vui lòng liên hệ đơn vị xử lý để được hỗ trợ.';
  }
  if (file.trangThai === 'nhap') {
    return 'Trạng thái hiện tại: Hồ sơ được trả về để sinh viên chỉnh sửa và nộp lại.';
  }
  if (file.trangThai === 'tre_han' || instance?.status === 'overdue') {
    return currentStepName
      ? `Trạng thái hiện tại: Hồ sơ đã trễ hạn tại bước ${currentStepName}.`
      : 'Trạng thái hiện tại: Hồ sơ đã trễ hạn xử lý.';
  }
  if (currentStepName) {
    return `Trạng thái hiện tại: Đang chờ ${currentStepName} xử lý hồ sơ.`;
  }
  return 'Trạng thái hiện tại: Hồ sơ đã được tiếp nhận và đang chờ xử lý.';
};

const resolveStepState = (stepOrder, instance, file) => {
  if (!instance) {
    return file.trangThai === 'da_duyet' ? 'completed' : 'upcoming';
  }

  if (instance.status === 'rejected') {
    const rejected = instance.steps?.find((s) => s.action === 'rejected');
    if (rejected?.stepOrder === stepOrder) return 'rejected';
    const handled = instance.steps?.some(
      (s) => s.stepOrder === stepOrder && s.action !== 'rejected' && s.action !== 'withdrawn',
    );
    return handled ? 'completed' : 'upcoming';
  }

  if (instance.status === 'cancelled' || file.trangThai === 'da_huy') {
    const handled = instance.steps?.some(
      (s) => s.stepOrder === stepOrder && s.action !== 'withdrawn',
    );
    return handled ? 'completed' : 'upcoming';
  }

  if (instance.status === 'completed' || file.trangThai === 'da_duyet') {
    return 'completed';
  }

  if (file.trangThai === 'nhap' && instance.currentStepOrder === 0) {
    return 'upcoming';
  }

  if (stepOrder < instance.currentStepOrder) return 'completed';
  if (stepOrder === instance.currentStepOrder) return 'current';
  return 'upcoming';
};

const buildWorkflowSteps = (workflow, instance, file) => {
  const defs = workflow?.steps || [];
  const historyByOrder = new Map(
    (instance?.steps || []).map((entry) => [entry.stepOrder, entry]),
  );

  return defs.map((def) => {
    const history = historyByOrder.get(def.stepOrder);
    const state = resolveStepState(def.stepOrder, instance, file);
    return {
      stepOrder: def.stepOrder,
      stepName: def.stepName || getRoleLabel(def.role),
      role: def.role,
      roleLabel: getRoleLabel(def.role),
      state,
      handledAt: history?.handledAt || null,
      action: history?.action || null,
      comment: history?.comment || '',
    };
  });
};

const buildTimeline = (file, instance) => {
  const items = [];

  items.push({
    at: file.createdAt,
    timeDisplay: formatDateTime(file.createdAt),
    message: 'Sinh viên ký và nộp đơn thành công',
    icon: 'fa-file-signature',
  });

  if (instance?.startedAt) {
    items.push({
      at: instance.startedAt,
      timeDisplay: formatDateTime(instance.startedAt),
      message: 'Hệ thống đã tiếp nhận hồ sơ',
      icon: 'fa-file-import',
    });
  }

  for (const entry of instance?.steps || []) {
    const actionText = ACTION_MESSAGES[entry.action] || entry.action;
    items.push({
      at: entry.handledAt,
      timeDisplay: formatDateTime(entry.handledAt),
      message: `${entry.stepName || getRoleLabel(entry.assignedRole)} ${actionText}`,
      icon: getStepIcon(
        entry.assignedRole,
        entry.action === 'rejected'
          ? 'rejected'
          : entry.action === 'withdrawn'
            ? 'withdrawn'
            : 'completed',
      ),
      comment: entry.comment || '',
    });
  }

  if (instance?.status === 'completed' || file.trangThai === 'da_duyet') {
    items.push({
      at: instance?.completedAt || file.updatedAt,
      timeDisplay: formatDateTime(instance?.completedAt || file.updatedAt),
      message: 'Thủ tục đã hoàn tất',
      icon: 'fa-clipboard-check',
    });
  }

  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
};

const getCurrentStepName = (workflow, instance) => {
  if (!instance || !workflow?.steps?.length) return '';
  if (
    instance.status === 'completed' ||
    instance.status === 'rejected' ||
    instance.status === 'cancelled'
  ) {
    return '';
  }
  if (instance.currentStepOrder === 0) return '';
  const current = workflow.steps.find((s) => s.stepOrder === instance.currentStepOrder);
  return current?.stepName || getRoleLabel(current?.role) || '';
};

const canStudentCancel = (file, instance) => {
  if (!file) return false;
  if (file.trangThai === 'da_duyet' || instance?.status === 'completed') return false;
  if (file.trangThai === 'tu_choi' || instance?.status === 'rejected') return false;
  if (file.trangThai === 'da_huy' || instance?.status === 'cancelled') return false;
  return ['cho_duyet', 'tre_han', 'nhap'].includes(file.trangThai);
};

export const assertStudentCanViewSubmission = (file, user) => {
  if (
    user?.role === 'student' &&
    file.submittedBy &&
    String(file.submittedBy) !== String(user.id)
  ) {
    throw new ForbiddenError('Bạn không có quyền xem hồ sơ này');
  }
};

export const buildSubmissionProgress = async (generatedFileId) => {
  const file = await GeneratedFile.findById(generatedFileId);
  if (!file) throw new NotFoundError('Không tìm thấy hồ sơ');

  const instance = await workflowRepository.findInstanceByGeneratedFile(generatedFileId);
  let workflow = instance?.workflowId;
  if (!workflow && file.loaiDonId) {
    try {
      workflow = await resolveWorkflowForLoaiDon(file.loaiDonId);
    } catch {
      workflow = null;
    }
  }

  if (instance && workflow) {
    await applyOverdueIfNeeded(instance, workflow);
    if (instance.status === 'overdue' && file.trangThai === 'cho_duyet') {
      file.trangThai = 'tre_han';
    }
  }

  const currentStepName = getCurrentStepName(workflow, instance);
  const currentStep = getCurrentStepDef(workflow, instance?.currentStepOrder);
  const deadlineAt = getStepDeadlineAt(instance, currentStep);
  const steps = buildWorkflowSteps(workflow, instance, file);
  const timeline = buildTimeline(file, instance);

  return {
    submission: {
      _id: file._id,
      tenDon: file.tenDon,
      tenNguoiGui: file.tenNguoiGui,
      trangThai: file.trangThai,
      duongDanFile: file.duongDanFile,
      fileMimeType: file.fileMimeType,
      createdAt: file.createdAt,
      cancelReason: file.cancelReason || '',
      cancelledAt: file.cancelledAt || null,
      currentStepOrder: file.currentStepOrder ?? instance?.currentStepOrder ?? 0,
      workflowInstanceId: file.workflowInstanceId || instance?._id || null,
    },
    workflowStatus:
      instance?.status ||
      (file.trangThai === 'da_duyet'
        ? 'completed'
        : file.trangThai === 'da_huy'
          ? 'cancelled'
          : 'pending'),
    statusDisplay: buildStatusDisplay(file, instance, currentStepName),
    statusSummary: buildStatusSummary(file, instance, currentStepName),
    currentStepOrder: instance?.currentStepOrder ?? file.currentStepOrder ?? 0,
    currentStepName,
    deadlineDays: currentStep?.deadlineDays ?? null,
    deadlineAt: deadlineAt || null,
    isOverdue: file.trangThai === 'tre_han' || instance?.status === 'overdue',
    canCancel: canStudentCancel(file, instance),
    totalSteps: workflow?.steps?.length || 0,
    steps,
    timeline,
  };
};

export const enrichStudentSubmissions = async (files = []) => {
  if (!files.length) return [];

  const ids = files.map((f) => f._id);
  const instances = await WorkflowInstance.find({ generatedFileId: { $in: ids } }).populate(
    'workflowId',
  );
  const instanceMap = new Map(instances.map((i) => [String(i.generatedFileId), i]));

  return Promise.all(
    files.map(async (file) => {
      let instance = instanceMap.get(String(file._id));
      let workflow = instance?.workflowId;
      if (!workflow && file.loaiDonId) {
        try {
          workflow = await resolveWorkflowForLoaiDon(file.loaiDonId);
        } catch {
          workflow = null;
        }
      }
      if (instance && workflow) {
        await applyOverdueIfNeeded(instance, workflow);
        if (instance.status === 'overdue' && file.trangThai === 'cho_duyet') {
          file.trangThai = 'tre_han';
        }
      }
      const currentStepName = getCurrentStepName(workflow, instance);
      return {
        ...file.toObject(),
        trangThai: file.trangThai,
        progress: {
          statusDisplay: buildStatusDisplay(file, instance, currentStepName),
          currentStepName,
          currentStepOrder: instance?.currentStepOrder ?? file.currentStepOrder ?? 0,
          totalSteps: workflow?.steps?.length || 0,
          workflowStatus: instance?.status || 'pending',
          isOverdue: file.trangThai === 'tre_han' || instance?.status === 'overdue',
        },
      };
    }),
  );
};
