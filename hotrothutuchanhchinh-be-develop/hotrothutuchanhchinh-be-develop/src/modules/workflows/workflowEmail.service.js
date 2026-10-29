import User from '../users/user.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { getCurrentStepDef } from './engines/workflowEngine.js';
import { filterUsersBySubmissionScope, findUsersForWorkflowStep } from './workflowScope.js';
import { ROLE_LABELS } from '../../config/roles.js';
import { sendWorkflowEmail } from '../../shared/services/emailService.js';
import { getAdminPortalUrl, getStudentPortalUrl } from '../../config/clientUrls.js';
import * as workflowNotification from '../notifications/workflowNotification.service.js';

const formatDateTime = (value = new Date()) =>
  new Date(value).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const getSubmissionCode = (fileId) => String(fileId).slice(-6).toUpperCase();

const getRoleLabel = (role) => ROLE_LABELS[role] || role;

const loadSubmissionContext = async (instance) => {
  const fileId = instance.generatedFileId?._id || instance.generatedFileId;
  const file = await GeneratedFile.findById(fileId).populate(
    'submittedBy',
    'email fullName studentId role khoaId boMonId lopId giangVienId sinhVienId',
  );

  if (!file) return null;

  const submitter = file.submittedBy;

  return {
    file,
    fileId: file._id,
    formName: file.tenDon,
    submitterName: submitter?.fullName || file.tenNguoiGui,
    submitterEmail: submitter?.email || null,
    submissionCode: getSubmissionCode(file._id),
    submittedAt: file.createdAt,
  };
};

const getApproversForStep = async (step, file) => {
  if (!step?.role) return [];
  return filterUsersBySubmissionScope(await findUsersForWorkflowStep(step, file), file, step);
};

const sendToUsers = async (users, payloadBuilder) => {
  const uniqueUsers = new Map();
  for (const user of users) {
    if (!user?.email) continue;
    uniqueUsers.set(String(user._id), user);
  }

  await Promise.all(
    [...uniqueUsers.values()].map(async (user) => {
      const payload = payloadBuilder(user);
      if (!payload) return;
      await sendWorkflowEmail({ to: user.email, ...payload });
    }),
  );
};

const sendToStudent = async (context, payload) => {
  if (!context?.submitterEmail) return;
  await sendWorkflowEmail({ to: context.submitterEmail, ...payload });
};

const baseDetails = (context, extra = []) => [
  { label: 'Tên đơn', value: context.formName },
  { label: 'Mã hồ sơ', value: context.submissionCode },
  { label: 'Sinh viên', value: context.submitterName },
  ...extra,
];

export const notifySubmissionCreated = async (instance, workflow, submitterId) => {
  const context = await loadSubmissionContext(instance);
  if (!context) return;

  if (!context.submitterEmail && submitterId) {
    const submitter = await User.findById(submitterId).select('email fullName studentId');
    if (submitter?.email) {
      context.submitterEmail = submitter.email;
      context.submitterName = submitter.fullName || context.submitterName;
    }
  }

  const firstStep = getCurrentStepDef(workflow, 1);
  const firstStepLabel = firstStep?.stepName || 'Bước duyệt đầu tiên';

  await sendToStudent(context, {
    subject: `[CTUT] Xác nhận đã nộp đơn: ${context.formName}`,
    heading: 'Đã nộp đơn thành công',
    paragraphs: [
      `Xin chào <strong>${context.submitterName}</strong>,`,
      `Hệ thống đã ghi nhận đơn <strong>${context.formName}</strong> của bạn.`,
      `Đơn hiện đang chờ <strong>${firstStepLabel}</strong> xử lý.`,
    ],
    details: baseDetails(context, [
      { label: 'Thời gian nộp', value: formatDateTime(context.submittedAt) },
      { label: 'Bước tiếp theo', value: firstStepLabel },
    ]),
    actionUrl: getStudentPortalUrl(),
    actionLabel: 'Xem cổng sinh viên',
  });

  if (!firstStep?.role) return;

  const approvers = await getApproversForStep(firstStep, context.file);
  await sendToUsers(approvers, (user) => ({
    subject: `[CTUT] Có đơn cần ký xác nhận: ${context.formName}`,
    heading: 'Có hồ sơ chờ bạn xử lý',
    paragraphs: [
      `Xin chào <strong>${user.fullName}</strong>,`,
      `Sinh viên <strong>${context.submitterName}</strong> vừa nộp đơn <strong>${context.formName}</strong>.`,
      `Bạn cần xử lý bước <strong>${firstStepLabel}</strong>.`,
    ],
    details: baseDetails(context, [
      { label: 'Thời gian nộp', value: formatDateTime(context.submittedAt) },
      { label: 'Vai trò xử lý', value: getRoleLabel(firstStep.role) },
    ]),
    actionUrl: `${getAdminPortalUrl()}/workflows/pending`,
    actionLabel: 'Mở danh sách chờ duyệt',
  }));

  await workflowNotification.notifySubmissionCreatedInApp(instance, workflow);
};

export const notifyStepApproved = async ({
  instance,
  workflow,
  actor,
  completedStep,
  nextStepDef,
  isFinal,
  comment,
}) => {
  const context = await loadSubmissionContext(instance);
  if (!context) return;

  const actorName = actor.fullName || actor.email || 'Người xử lý';
  const actorRole = getRoleLabel(actor.role);
  const completedStepName = completedStep?.stepName || 'Bước duyệt';

  if (isFinal) {
    await sendToStudent(context, {
      subject: `[CTUT] Đơn đã được duyệt: ${context.formName}`,
      heading: 'Đơn đã hoàn tất quy trình',
      paragraphs: [
        `Xin chào <strong>${context.submitterName}</strong>,`,
        `Đơn <strong>${context.formName}</strong> đã được duyệt hoàn tất.`,
        `Bước cuối cùng do <strong>${actorName}</strong> (${actorRole}) xử lý.`,
      ],
      details: baseDetails(context, [
        { label: 'Người duyệt cuối', value: `${actorName} (${actorRole})` },
        { label: 'Thời gian', value: formatDateTime() },
        ...(comment ? [{ label: 'Ghi chú', value: comment }] : []),
      ]),
      actionUrl: getStudentPortalUrl(),
      actionLabel: 'Xem cổng sinh viên',
    });
    await workflowNotification.notifyStepAdvancedInApp({
      instance,
      nextStepDef,
      completedStep,
      actor,
      isFinal: true,
    });
    return;
  }

  const nextStepName = nextStepDef?.stepName || 'Bước tiếp theo';

  await sendToStudent(context, {
    subject: `[CTUT] Đơn đã được ký: ${context.formName}`,
    heading: 'Đơn đã được ký xác nhận',
    paragraphs: [
      `Xin chào <strong>${context.submitterName}</strong>,`,
      `Đơn <strong>${context.formName}</strong> đã được <strong>${actorName}</strong> (${actorRole}) ký tại bước <strong>${completedStepName}</strong>.`,
      `Đơn hiện chuyển tới <strong>${nextStepName}</strong> để tiếp tục xử lý.`,
    ],
    details: baseDetails(context, [
      { label: 'Người vừa ký', value: `${actorName} (${actorRole})` },
      { label: 'Bước vừa hoàn thành', value: completedStepName },
      { label: 'Bước tiếp theo', value: nextStepName },
      ...(comment ? [{ label: 'Ghi chú', value: comment }] : []),
    ]),
    actionUrl: getStudentPortalUrl(),
    actionLabel: 'Xem cổng sinh viên',
  });

  if (!nextStepDef?.role) return;

  const approvers = await getApproversForStep(nextStepDef, context.file);
  await sendToUsers(approvers, (user) => ({
    subject: `[CTUT] Có đơn cần ký xác nhận: ${context.formName}`,
    heading: 'Có hồ sơ chờ bạn xử lý',
    paragraphs: [
      `Xin chào <strong>${user.fullName}</strong>,`,
      `Đơn <strong>${context.formName}</strong> của sinh viên <strong>${context.submitterName}</strong> đã qua bước <strong>${completedStepName}</strong>.`,
      `Bạn cần xử lý bước <strong>${nextStepName}</strong>.`,
    ],
    details: baseDetails(context, [
      { label: 'Người vừa ký', value: `${actorName} (${actorRole})` },
      { label: 'Bước cần xử lý', value: nextStepName },
      { label: 'Vai trò xử lý', value: getRoleLabel(nextStepDef.role) },
    ]),
    actionUrl: `${getAdminPortalUrl()}/workflows/pending`,
    actionLabel: 'Mở danh sách chờ duyệt',
  }));

  await workflowNotification.notifyStepAdvancedInApp({
    instance,
    nextStepDef,
    completedStep,
    actor,
    isFinal: false,
  });
};

export const notifyRejected = async ({ instance, actor, completedStep, comment }) => {
  const context = await loadSubmissionContext(instance);
  if (!context) return;

  const actorName = actor.fullName || actor.email || 'Người xử lý';
  const actorRole = getRoleLabel(actor.role);
  const stepName = completedStep?.stepName || 'Bước duyệt';

  await sendToStudent(context, {
    subject: `[CTUT] Đơn bị từ chối: ${context.formName}`,
    heading: 'Đơn đã bị từ chối',
    paragraphs: [
      `Xin chào <strong>${context.submitterName}</strong>,`,
      `Đơn <strong>${context.formName}</strong> đã bị từ chối tại bước <strong>${stepName}</strong>.`,
      `Người xử lý: <strong>${actorName}</strong> (${actorRole}).`,
    ],
    details: baseDetails(context, [
      { label: 'Bước từ chối', value: stepName },
      { label: 'Người từ chối', value: `${actorName} (${actorRole})` },
      { label: 'Thời gian', value: formatDateTime() },
      ...(comment ? [{ label: 'Lý do', value: comment }] : []),
    ]),
    actionUrl: getStudentPortalUrl(),
    actionLabel: 'Xem cổng sinh viên',
  });

  await workflowNotification.notifyRejectedInApp({ instance, actor, completedStep, comment });
};

export const notifyReturned = async ({ instance, actor, completedStep, comment }) => {
  const context = await loadSubmissionContext(instance);
  if (!context) return;

  const actorName = actor.fullName || actor.email || 'Người xử lý';
  const actorRole = getRoleLabel(actor.role);
  const stepName = completedStep?.stepName || 'Bước duyệt';

  await sendToStudent(context, {
    subject: `[CTUT] Đơn được trả về: ${context.formName}`,
    heading: 'Đơn được trả về để chỉnh sửa',
    paragraphs: [
      `Xin chào <strong>${context.submitterName}</strong>,`,
      `Đơn <strong>${context.formName}</strong> đã được trả về tại bước <strong>${stepName}</strong>.`,
      `Vui lòng chỉnh sửa và nộp lại theo hướng dẫn.`,
    ],
    details: baseDetails(context, [
      { label: 'Bước trả về', value: stepName },
      { label: 'Người trả về', value: `${actorName} (${actorRole})` },
      { label: 'Thời gian', value: formatDateTime() },
      ...(comment ? [{ label: 'Ghi chú', value: comment }] : []),
    ]),
    actionUrl: getStudentPortalUrl(),
    actionLabel: 'Mở cổng sinh viên',
  });
};

export const notifyCancelled = async ({ instance, actor, currentStep, reason }) => {
  const context = await loadSubmissionContext(instance);
  if (!context) return;

  const stepName =
    currentStep?.stepName || getRoleLabel(currentStep?.role) || 'Bước đang xử lý';
  const studentName = actor?.fullName || context.submitterName || 'Sinh viên';

  await sendToStudent(context, {
    subject: `[CTUT] Đã rút đơn: ${context.formName}`,
    heading: 'Bạn đã rút hồ sơ thành công',
    paragraphs: [
      `Xin chào <strong>${context.submitterName}</strong>,`,
      `Hệ thống đã ghi nhận việc rút đơn <strong>${context.formName}</strong>.`,
      `Nếu cần tiếp tục thủ tục, vui lòng nộp đơn mới.`,
    ],
    details: baseDetails(context, [
      { label: 'Thời gian rút', value: formatDateTime() },
      { label: 'Bước lúc rút', value: stepName },
      ...(reason ? [{ label: 'Lý do rút', value: reason }] : []),
    ]),
    actionUrl: getStudentPortalUrl(),
    actionLabel: 'Mở cổng sinh viên',
  });

  const approvers = currentStep?.role ? await getApproversForStep(currentStep, context.file) : [];
  await sendToUsers(approvers, (user) => ({
    subject: `[CTUT] Sinh viên đã rút đơn: ${context.formName}`,
    heading: 'Hồ sơ đã bị rút',
    paragraphs: [
      `Xin chào <strong>${user.fullName}</strong>,`,
      `Sinh viên <strong>${studentName}</strong> đã rút đơn <strong>${context.formName}</strong> đang chờ bạn xử lý.`,
      `Bạn không cần xử lý hồ sơ này nữa.`,
    ],
    details: baseDetails(context, [
      { label: 'Bước lúc rút', value: stepName },
      { label: 'Thời gian', value: formatDateTime() },
      ...(reason ? [{ label: 'Lý do rút', value: reason }] : []),
    ]),
    actionUrl: `${getAdminPortalUrl()}/workflows/pending`,
    actionLabel: 'Mở danh sách chờ duyệt',
  }));

  await workflowNotification.notifyCancelledInApp({
    instance,
    actor,
    currentStep,
    reason,
  });
};

const safeNotify = (taskName, fn) => {
  fn().catch((error) => {
    console.error(`[WorkflowEmail] ${taskName} failed:`, error.message);
  });
};

export const queueSubmissionCreated = (instance, workflow, submitterId) =>
  safeNotify('notifySubmissionCreated', () =>
    notifySubmissionCreated(instance, workflow, submitterId),
  );

export const queueStepApproved = (payload) =>
  safeNotify('notifyStepApproved', () => notifyStepApproved(payload));

export const queueRejected = (payload) =>
  safeNotify('notifyRejected', () => notifyRejected(payload));

export const notifyReturnedToPrevious = async ({
  instance,
  actor,
  completedStep,
  previousStep,
  comment,
}) => {
  const context = await loadSubmissionContext(instance);
  if (!context || !previousStep?.role) return;

  const actorName = actor.fullName || actor.email || 'Người xử lý';
  const stepName = previousStep.stepName || getRoleLabel(previousStep.role);
  const approvers = await getApproversForStep(previousStep, context.file);

  await sendToUsers(approvers, (user) => ({
    subject: `[CTUT] Hồ sơ được trả về: ${context.formName}`,
    heading: 'Có hồ sơ được trả về để kiểm tra lại',
    paragraphs: [
      `Xin chào <strong>${user.fullName}</strong>,`,
      `Đơn <strong>${context.formName}</strong> của sinh viên <strong>${context.submitterName}</strong> được trả về bước <strong>${stepName}</strong>.`,
      `Người trả: <strong>${actorName}</strong>.`,
    ],
    details: baseDetails(context, [
      { label: 'Bước cần xử lý lại', value: stepName },
      ...(comment ? [{ label: 'Lý do', value: comment }] : []),
    ]),
    actionUrl: `${getAdminPortalUrl()}/workflows/pending`,
    actionLabel: 'Mở danh sách chờ xử lý',
  }));
};

export const queueReturned = (payload) =>
  safeNotify('notifyReturned', () => notifyReturned(payload));

export const queueReturnedToPrevious = (payload) =>
  safeNotify('notifyReturnedToPrevious', () => notifyReturnedToPrevious(payload));

export const queueCancelled = (payload) =>
  safeNotify('notifyCancelled', () => notifyCancelled(payload));
