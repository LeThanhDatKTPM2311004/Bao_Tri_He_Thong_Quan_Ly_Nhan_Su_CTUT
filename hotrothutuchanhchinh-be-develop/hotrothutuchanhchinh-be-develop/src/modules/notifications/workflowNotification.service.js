import User from '../users/user.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { getCurrentStepDef } from '../workflows/engines/workflowEngine.js';
import {
  filterUsersBySubmissionScope,
  findUsersForWorkflowStep,
  findAssistantsForLeaderStep,
} from '../workflows/workflowScope.js';
import { ROLE_LABELS, ROLES } from '../../config/roles.js';
import * as notificationService from './notification.service.js';

const codeOf = (fileId) => String(fileId).slice(-6).toUpperCase();

const loadContext = async (instance) => {
  const fileId = instance.generatedFileId?._id || instance.generatedFileId;
  const file = await GeneratedFile.findById(fileId).populate(
    'submittedBy',
    'email fullName studentId role khoaId boMonId lopId giangVienId sinhVienId',
  );
  if (!file) return null;
  return {
    file,
    fileId: file._id,
    formName: file.tenDon,
    submitterName: file.submittedBy?.fullName || file.tenNguoiGui || 'Sinh viên',
    submissionCode: codeOf(file._id),
  };
};

const findActiveUsersByRoles = async (roles) => {
  const uniqueRoles = [...new Set(roles.filter(Boolean))];
  if (!uniqueRoles.length) return [];
  return User.find({ role: { $in: uniqueRoles }, isActive: true }).select(
    '_id fullName role khoaId boMonId lopId giangVienId',
  );
};

const createForUsers = async (users, payload) => {
  const seen = new Set();
  await Promise.all(
    users.map(async (user) => {
      const id = String(user._id);
      if (seen.has(id)) return;
      seen.add(id);
      if (payload.entityId && payload.type) {
        await notificationService.upsertEntityNotification({
          recipientId: user._id,
          channels: ['in_app'],
          ...payload,
        });
        return;
      }
      await notificationService.create({
        recipientId: user._id,
        channels: ['in_app'],
        ...payload,
      });
    }),
  );
};

/** Thông báo cán bộ đúng vai trò bước hiện tại (+ admin), lọc theo phạm vi hồ sơ / đơn vị. */
export const notifyStaffForStep = async ({
  role,
  step = null,
  type,
  title,
  message,
  entityId,
  file = null,
  includeAdmins = true,
}) => {
  const effectiveStep = step || (role ? { role, assigneeDepartment: null } : null);
  const roles = [effectiveStep?.role].filter(Boolean);
  if (includeAdmins) roles.push(ROLES.ADMIN);
  let users = await findActiveUsersByRoles(roles);
  if (file) {
    const stepUsers = effectiveStep?.role
      ? await findUsersForWorkflowStep(effectiveStep, file)
      : users.filter((u) => u.role !== ROLES.ADMIN);
    const scoped = await filterUsersBySubmissionScope(
      stepUsers.filter((u) => u.role !== ROLES.ADMIN),
      file,
      effectiveStep,
    );
    const admins = includeAdmins ? users.filter((u) => u.role === ROLES.ADMIN) : [];
    users = [...scoped, ...admins];
  }
  if (!users.length) return;
  await createForUsers(users, {
    type,
    title,
    message,
    entityType: 'GeneratedFile',
    entityId,
  });
};

/** Nhắc trợ lý đơn vị khi đơn đang chờ trưởng khoa/phòng/TT ký */
export const notifyAssistantsForLeaderStep = async ({ step, file, formName, submitterName, submissionCode, fileId }) => {
  if (!step?.role || !file) return;
  const assistants = await findAssistantsForLeaderStep(step, file);
  if (!assistants.length) return;

  const leaderLabel = step.stepName || ROLE_LABELS[step.role] || step.role;
  await createForUsers(assistants, {
    type: 'submission_in_progress',
    title: `Cần nhắc duyệt: ${formName}`,
    message: `Đơn mã ${submissionCode} của ${submitterName} đang chờ «${leaderLabel}» ký — hãy nhắc trưởng/đơn vị xử lý.`,
    entityType: 'GeneratedFile',
    entityId: fileId,
  });
};

export const notifySubmissionCreatedInApp = async (instance, workflow) => {
  const context = await loadContext(instance);
  if (!context) return;
  const firstStep = getCurrentStepDef(workflow, 1);
  if (!firstStep?.role) return;

  await notifyStaffForStep({
    role: firstStep.role,
    step: firstStep,
    type: 'signature_required',
    title: `Hồ sơ chờ xử lý: ${context.formName}`,
    message: `Sinh viên ${context.submitterName} vừa nộp đơn (mã ${context.submissionCode}). Bước: ${firstStep.stepName || ROLE_LABELS[firstStep.role] || firstStep.role}.`,
    entityId: context.fileId,
    file: context.file,
  });

  await notifyAssistantsForLeaderStep({
    step: firstStep,
    file: context.file,
    formName: context.formName,
    submitterName: context.submitterName,
    submissionCode: context.submissionCode,
    fileId: context.fileId,
  });
};

export const notifyStepAdvancedInApp = async ({
  instance,
  nextStepDef,
  completedStep,
  actor,
  isFinal,
}) => {
  const context = await loadContext(instance);
  if (!context) return;
  const actorName = actor?.fullName || actor?.email || 'Cán bộ';

  if (isFinal) {
    const admins = await findActiveUsersByRoles([ROLES.ADMIN]);
    await createForUsers(admins, {
      type: 'submission_approved',
      title: `Hồ sơ hoàn tất: ${context.formName}`,
      message: `Đơn mã ${context.submissionCode} của ${context.submitterName} đã được duyệt hoàn tất bởi ${actorName}.`,
      entityType: 'GeneratedFile',
      entityId: context.fileId,
    });
    return;
  }

  if (!nextStepDef?.role) return;
  await notifyStaffForStep({
    role: nextStepDef.role,
    step: nextStepDef,
    type: 'signature_required',
    title: `Hồ sơ chờ xử lý: ${context.formName}`,
    message: `Đơn mã ${context.submissionCode} đã qua bước «${completedStep?.stepName || 'trước'}». Bạn cần xử lý bước «${nextStepDef.stepName || ROLE_LABELS[nextStepDef.role]}».`,
    entityId: context.fileId,
    file: context.file,
  });

  await notifyAssistantsForLeaderStep({
    step: nextStepDef,
    file: context.file,
    formName: context.formName,
    submitterName: context.submitterName,
    submissionCode: context.submissionCode,
    fileId: context.fileId,
  });
};

export const notifyRejectedInApp = async ({ instance, actor, completedStep, comment }) => {
  const context = await loadContext(instance);
  if (!context) return;
  const actorName = actor?.fullName || actor?.email || 'Cán bộ';
  const admins = await findActiveUsersByRoles([ROLES.ADMIN]);
  await createForUsers(admins, {
    type: 'submission_rejected',
    title: `Hồ sơ bị từ chối: ${context.formName}`,
    message: `Đơn mã ${context.submissionCode} bị từ chối tại «${completedStep?.stepName || 'bước duyệt'}» bởi ${actorName}${comment ? `. Lý do: ${comment}` : ''}.`,
    entityType: 'GeneratedFile',
    entityId: context.fileId,
  });
};

export const notifyCancelledInApp = async ({ instance, actor, currentStep, reason }) => {
  const context = await loadContext(instance);
  if (!context) return;
  const studentName = actor?.fullName || context.submitterName || 'Sinh viên';
  const stepLabel =
    currentStep?.stepName || ROLE_LABELS[currentStep?.role] || currentStep?.role || 'đang xử lý';

  await notifyStaffForStep({
    role: currentStep?.role,
    step: currentStep,
    type: 'submission_cancelled',
    title: `Sinh viên đã hủy đơn: ${context.formName}`,
    message: `${studentName} đã hủy đơn mã ${context.submissionCode} khi đang ở bước «${stepLabel}». Lý do: ${reason || '—'}.`,
    entityId: context.fileId,
    file: context.file,
  });

  await notifyLeadersOfCancellation({ instance, actor, reason });
};

export const notifyOverdueInApp = async (instance, workflow) => {
  const context = await loadContext(instance);
  if (!context) return;
  const step = getCurrentStepDef(workflow, instance.currentStepOrder);
  if (!step?.role) return;

  // Tránh spam: chỉ tạo nếu chưa có unread deadline_warning cho hồ sơ này + người nhận
  const roleUsers = await findUsersForWorkflowStep(step, context.file);
  const scoped = await filterUsersBySubmissionScope(roleUsers, context.file, step);
  const assistants = await findAssistantsForLeaderStep(step, context.file);
  const admins = await findActiveUsersByRoles([ROLES.ADMIN]);
  const users = [...scoped, ...assistants, ...admins];
  await Promise.all(
    users.map(async (user) => {
      const exists = await notificationService.findUnreadByEntity(
        user._id,
        context.fileId,
        'deadline_warning',
      );
      if (exists) return;
      const isAssistant = [
        ROLES.KHOA_ASSISTANT,
        ROLES.PHONG_ASSISTANT,
        ROLES.TRUNG_TAM_ASSISTANT,
      ].includes(user.role);
      await notificationService.create({
        recipientId: user._id,
        type: 'deadline_warning',
        title: `Hồ sơ quá hạn: ${context.formName}`,
        message: isAssistant
          ? `Đơn mã ${context.submissionCode} của ${context.submitterName} đã quá hạn ở bước «${step.stepName || ROLE_LABELS[step.role]}» — hãy nhắc trưởng/đơn vị xử lý.`
          : `Đơn mã ${context.submissionCode} của ${context.submitterName} đã quá hạn ở bước «${step.stepName || ROLE_LABELS[step.role]}».`,
        entityType: 'GeneratedFile',
        entityId: context.fileId,
        channels: ['in_app'],
      });
    }),
  );
};

/**
 * Đồng bộ thông báo từ hồ sơ đang chờ của user (để chuông không trống với dữ liệu cũ).
 */
export const syncPendingNotificationsForUser = async (user, pendingTasks = []) => {
  if (!user?.id && !user?._id) return;
  const recipientId = user.id || user._id;

  for (const task of pendingTasks.slice(0, 30)) {
    const type = task.isOverdue ? 'deadline_warning' : 'signature_required';
    await notificationService.upsertEntityNotification({
      recipientId,
      type,
      title: task.isOverdue
        ? `Hồ sơ quá hạn: ${task.formName}`
        : `Hồ sơ chờ xử lý: ${task.formName}`,
      message: task.isOverdue
        ? `Đơn mã ${task.submissionCode} của ${task.submittedBy || 'sinh viên'} đã quá hạn ở bước «${task.currentStep}».`
        : `Đơn mã ${task.submissionCode} của ${task.submittedBy || 'sinh viên'} đang chờ bạn ở bước «${task.currentStep}».`,
      entityId: task.submissionId,
      markUnreadOnChange: false,
    });
  }
};

/**
 * Trưởng khoa / trưởng bộ môn: sync đơn trong phạm vi
 * (đang xử lý + bước hiện tại, trễ hạn, đã hủy).
 */
export const syncLeaderScopeNotifications = async (user, overviewItems = []) => {
  if (!user?.id && !user?._id) return;
  const recipientId = user.id || user._id;

  for (const item of overviewItems.slice(0, 60)) {
    if (item.kind === 'cancelled') {
      await notificationService.upsertEntityNotification({
        recipientId,
        type: 'submission_cancelled',
        title: `Sinh viên đã hủy đơn: ${item.formName}`,
        message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} đã bị hủy${
          item.cancelReason ? `. Lý do: ${item.cancelReason}` : ''
        }.`,
        entityId: item.submissionId,
      });
      continue;
    }

    if (item.kind === 'overdue') {
      await notificationService.upsertEntityNotification({
        recipientId,
        type: 'deadline_warning',
        title: `Hồ sơ quá hạn: ${item.formName}`,
        message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} đã quá hạn ở bước «${
          item.currentStep || 'đang xử lý'
        }» (phạm vi khoa/bộ môn của bạn).`,
        entityId: item.submissionId,
      });
      continue;
    }

    // Đang xử lý — báo bước hiện tại (bỏ qua nếu đã có thông báo chờ họ ký)
    const awaitingSelf = await notificationService.findUnreadByEntity(
      recipientId,
      item.submissionId,
      'signature_required',
    );
    if (awaitingSelf) continue;

    await notificationService.upsertEntityNotification({
      recipientId,
      type: 'submission_in_progress',
      title: `Đơn đang xử lý: ${item.formName}`,
      message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} đang ở bước «${
        item.currentStep || 'tiếp nhận'
      }».`,
      entityId: item.submissionId,
    });
  }
};

/**
 * Trợ lý khoa/phòng/TT: sync đơn chờ trưởng / quá hạn / sắp quá hạn (không báo «cần bạn ký»).
 */
export const syncAssistantScopeNotifications = async (user, monitorItems = []) => {
  if (!user?.id && !user?._id) return;
  const recipientId = user.id || user._id;

  for (const item of monitorItems.slice(0, 60)) {
    if (item.kind === 'completed' || item.kind === 'cancelled') continue;

    if (item.isOverdue || item.kind === 'overdue') {
      await notificationService.upsertEntityNotification({
        recipientId,
        type: 'deadline_warning',
        title: `Quá hạn — cần nhắc duyệt: ${item.formName}`,
        message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} đã quá hạn ở bước «${
          item.currentStep || 'đang xử lý'
        }». Hãy nhắc trưởng/đơn vị ký duyệt.`,
        entityId: item.submissionId,
      });
      continue;
    }

    if (item.isDueSoon || item.kind === 'due_soon') {
      await notificationService.upsertEntityNotification({
        recipientId,
        type: 'deadline_warning',
        title: `Sắp quá hạn — cần nhắc duyệt: ${item.formName}`,
        message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} sắp quá hạn ở bước «${
          item.currentStep || 'đang xử lý'
        }». Hãy nhắc trưởng/đơn vị xử lý sớm.`,
        entityId: item.submissionId,
      });
      continue;
    }

    if (item.waitingLeader || item.kind === 'waiting_leader') {
      await notificationService.upsertEntityNotification({
        recipientId,
        type: 'submission_in_progress',
        title: `Cần nhắc duyệt: ${item.formName}`,
        message: `Đơn mã ${item.submissionCode} của ${item.submittedBy} đang chờ «${
          item.currentStep || 'trưởng đơn vị'
        }» ký.`,
        entityId: item.submissionId,
      });
    }
  }
};

/** Thông báo hủy đơn tới lãnh đạo khoa/bộ môn đúng phạm vi hồ sơ */
export const notifyLeadersOfCancellation = async ({ instance, actor, reason }) => {
  const context = await loadContext(instance);
  if (!context?.file) return;

  const leaders = await User.find({
    role: {
      $in: [
        ROLES.FACULTY_MANAGER,
        ROLES.DEPUTY_FACULTY_MANAGER,
        ROLES.DEPARTMENT_CHAIR,
        ROLES.DEPUTY_DEPARTMENT_CHAIR,
        ROLES.FACULTY_ASSISTANT,
      ],
    },
    isActive: true,
  }).select('_id fullName role khoaId boMonId lopId giangVienId');

  const scoped = await filterUsersBySubmissionScope(leaders, context.file);
  if (!scoped.length) return;

  const studentName = actor?.fullName || context.submitterName || 'Sinh viên';
  await createForUsers(scoped, {
    type: 'submission_cancelled',
    title: `Sinh viên đã hủy đơn: ${context.formName}`,
    message: `${studentName} đã hủy đơn mã ${context.submissionCode}${
      reason ? `. Lý do: ${reason}` : ''
    }.`,
    entityType: 'GeneratedFile',
    entityId: context.fileId,
  });
};
