import { ROLES, isAssistantRole } from '../../config/roles.js';
import { isWorkflowOfficeUnitRole } from './workflow.constants.js';
import { Workflow, WorkflowInstance } from './workflow.model.js';
import Lop from '../organization/models/lop.model.js';
import SinhVien from '../organization/models/sinhVien.model.js';
import User from '../users/user.model.js';

/** Vai trò duyệt toàn trường — không lọc theo khoa hồ sơ */
const SCHOOL_WIDE_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.STUDENT_AFFAIRS,
  ROLES.OFFICE_STAFF,
]);

/** Role bước trưởng mà trợ lý theo dõi để nhắc ký */
export const ASSISTANT_WATCH_LEADER_ROLES = {
  [ROLES.KHOA_ASSISTANT]: [ROLES.FACULTY_MANAGER, ROLES.DEPUTY_FACULTY_MANAGER],
  [ROLES.PHONG_ASSISTANT]: [ROLES.DEPARTMENT_HEAD, ROLES.DEPUTY_DEPARTMENT_HEAD],
  [ROLES.TRUNG_TAM_ASSISTANT]: [ROLES.CENTER_DIRECTOR, ROLES.DEPUTY_CENTER_DIRECTOR],
};

export const getAssistantWatchLeaderRoles = (assistantRole) =>
  ASSISTANT_WATCH_LEADER_ROLES[assistantRole] || [];

export const isAssistantOverviewRole = (role) => isAssistantRole(role);

export const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

export const normalizeDepartment = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

/**
 * Khớp User.department với đơn vị gắn trên bước quy trình.
 * Admin luôn khớp. Vai trò không thuộc phòng/TT → bỏ qua.
 * Bước cũ chưa gắn đơn vị → giữ hành vi cũ (mọi tài khoản cùng role).
 */
export const userMatchesStepUnit = (user, step) => {
  if (!user?.role || !step?.role) return false;
  if (user.role === ROLES.ADMIN) return true;
  if (!isWorkflowOfficeUnitRole(step.role)) return true;
  const required = normalizeDepartment(step.assigneeDepartment);
  if (!required) return true;
  return normalizeDepartment(user.department) === required;
};

/**
 * Trợ lý phòng/TT: khớp ĐÚNG tên đơn vị trên bước (bắt buộc có assigneeDepartment).
 * Không mở rộng khi bước thiếu đơn vị — tránh lộ đơn của phòng/TT khác.
 */
export const assistantMatchesOfficeUnit = (user, step) => {
  if (!user?.role || !step?.role) return false;
  if (
    user.role !== ROLES.PHONG_ASSISTANT &&
    user.role !== ROLES.TRUNG_TAM_ASSISTANT
  ) {
    return false;
  }
  const required = normalizeDepartment(step.assigneeDepartment);
  const mine = normalizeDepartment(user.department);
  if (!required || !mine) return false;
  return required === mine;
};

/**
 * Lấy ngữ cảnh tổ chức của sinh viên nộp đơn:
 * ưu tiên User.submittedBy; nếu thiếu khoa/bộ môn/lớp thì bổ sung từ hồ sơ SinhVien / Lop.
 */
export const resolveSubmitterOrgContext = async (file) => {
  const empty = { khoaId: null, boMonId: null, lopId: null, submitterUserId: null };
  if (!file) return empty;

  const submittedBy = file.submittedBy;
  const submittedByIsUser =
    submittedBy &&
    typeof submittedBy === 'object' &&
    submittedBy._bsontype !== 'ObjectId' &&
    (submittedBy.email != null ||
      submittedBy.role != null ||
      submittedBy.fullName != null ||
      submittedBy.khoaId != null ||
      submittedBy.sinhVienId != null ||
      submittedBy.studentId != null);

  let submitter = submittedByIsUser ? submittedBy : null;

  if (!submitter && submittedBy) {
    submitter = await User.findById(file.submittedBy)
      .select('fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId')
      .lean();
  }

  let khoaId = idOf(submitter?.khoaId);
  let boMonId = idOf(submitter?.boMonId);
  let lopId = idOf(submitter?.lopId);

  if (!khoaId || !boMonId || !lopId) {
    let sinhVien = null;
    if (submitter?.sinhVienId) {
      sinhVien = await SinhVien.findById(submitter.sinhVienId)
        .select('khoaId boMonId lopId')
        .lean();
    }
    if (!sinhVien && submitter?.studentId) {
      sinhVien = await SinhVien.findOne({
        maSV: String(submitter.studentId).trim().toUpperCase(),
        isActive: true,
      })
        .select('khoaId boMonId lopId')
        .lean();
    }
    if (!sinhVien && submitter?.email) {
      sinhVien = await SinhVien.findOne({
        email: String(submitter.email).trim().toLowerCase(),
        isActive: true,
      })
        .select('khoaId boMonId lopId')
        .lean();
    }

    if (sinhVien) {
      khoaId = khoaId || idOf(sinhVien.khoaId);
      boMonId = boMonId || idOf(sinhVien.boMonId);
      lopId = lopId || idOf(sinhVien.lopId);
    }
  }

  if (lopId && (!khoaId || !boMonId)) {
    const lop = await Lop.findById(lopId).select('khoaId boMonId').lean();
    if (lop) {
      khoaId = khoaId || idOf(lop.khoaId);
      boMonId = boMonId || idOf(lop.boMonId);
    }
  }

  return {
    khoaId,
    boMonId,
    lopId,
    submitterUserId: idOf(submitter?._id || file.submittedBy),
  };
};

/** User có phải cố vấn của lớp sinh viên nộp đơn? (kể cả khi User.role là lãnh đạo) */
export const isAdvisorOfSubmissionClass = async (user, file) => {
  const userGiangVienId = idOf(user?.giangVienId);
  if (!userGiangVienId || !file) return false;
  const { lopId: studentLopId } = await resolveSubmitterOrgContext(file);
  if (!studentLopId) return false;
  const lop = await Lop.findById(studentLopId).select('coVanId isActive').lean();
  if (!lop || lop.isActive === false) return false;
  return idOf(lop.coVanId) === userGiangVienId;
};

/**
 * Có quyền xử lý bước quy trình?
 * - Khớp User.role (hoặc admin)
 * - Hoặc bước CVHT và user là cố vấn lớp của hồ sơ (dù role đang là trưởng khoa…)
 * - Phòng / trung tâm: khớp đúng đơn vị đã cấu hình trên bước
 */
export const userCanHandleWorkflowStep = async (user, stepOrRole, file) => {
  if (!user?.role || !stepOrRole) return false;

  // Trợ lý khoa / trung tâm chỉ theo dõi. Trợ lý phòng xử lý đúng bước được giao trong phòng mình.
  if (isAssistantRole(user.role)) {
    const step =
      typeof stepOrRole === 'string' ? { role: stepOrRole, assigneeDepartment: null } : stepOrRole;
    if (user.role !== step?.role) return false;
    return assistantMatchesOfficeUnit(user, step);
  }

  const step =
    typeof stepOrRole === 'string' ? { role: stepOrRole, assigneeDepartment: null } : stepOrRole;
  const stepRole = step.role;
  if (!stepRole) return false;

  if (user.role === ROLES.ADMIN) return true;

  const roleOk =
    user.role === stepRole ||
    (stepRole === ROLES.ACADEMIC_ADVISOR && (await isAdvisorOfSubmissionClass(user, file)));
  if (!roleOk) return false;

  if (isWorkflowOfficeUnitRole(stepRole) && !userMatchesStepUnit(user, step)) {
    return false;
  }

  return true;
};

/**
 * Hồ sơ thuộc phạm vi người duyệt?
 * - BGH / hành chính: toàn trường
 * - Trưởng/phó phòng, GĐ/phó GĐ TT: theo User.department (đơn vị gắn tài khoản)
 * - Trưởng/phó khoa: cùng khoa
 * - Trưởng/phó bộ môn: cùng bộ môn (hoặc khoa)
 * - Cố vấn (role hoặc đang cố vấn lớp): lớp có coVanId = giangVienId
 *
 * @param {object} [step] — nếu có assigneeDepartment thì lọc đúng đơn vị bước đó
 */
export const isSubmissionInApproverScope = async (user, file, step = null) => {
  if (!user?.role || !file) return false;
  if (user.role === ROLES.ADMIN) return true;

  if (isWorkflowOfficeUnitRole(user.role) && !isAssistantRole(user.role)) {
    if (step && isWorkflowOfficeUnitRole(step.role)) {
      return userMatchesStepUnit(user, step);
    }
    // Overview / không có bước: cán bộ phòng/TT thấy hồ sơ toàn trường trong phạm vi đơn vị của họ
    // (pending vẫn lọc thêm qua userCanHandleWorkflowStep + bước hiện tại)
    return Boolean(normalizeDepartment(user.department));
  }

  if (SCHOOL_WIDE_ROLES.has(user.role)) return true;

  const org = await resolveSubmitterOrgContext(file);
  const studentKhoaId = org.khoaId;
  const studentBoMonId = org.boMonId;
  const studentLopId = org.lopId;
  const userKhoaId = idOf(user.khoaId);
  const userBoMonId = idOf(user.boMonId);
  const userGiangVienId = idOf(user.giangVienId);

  if (
    user.role === ROLES.FACULTY_MANAGER ||
    user.role === ROLES.DEPUTY_FACULTY_MANAGER ||
    user.role === ROLES.KHOA_ASSISTANT
  ) {
    // Thiếu khoa trên tài khoản cán bộ hoặc hồ sơ SV → không nhận đơn (tránh lộ toàn trường)
    if (!userKhoaId || !studentKhoaId) return false;
    return studentKhoaId === userKhoaId;
  }

  if (
    user.role === ROLES.PHONG_ASSISTANT ||
    user.role === ROLES.TRUNG_TAM_ASSISTANT
  ) {
    if (!normalizeDepartment(user.department)) return false;
    if (step && (step.role === user.role || isWorkflowOfficeUnitRole(step.role))) {
      return assistantMatchesOfficeUnit(user, step);
    }
    return false;
  }

  if (
    user.role === ROLES.DEPARTMENT_CHAIR ||
    user.role === ROLES.DEPUTY_DEPARTMENT_CHAIR ||
    user.role === ROLES.FACULTY_ASSISTANT
  ) {
    if (userBoMonId) {
      if (!studentBoMonId) return false;
      return studentBoMonId === userBoMonId;
    }
    if (userKhoaId) {
      if (!studentKhoaId) return false;
      return studentKhoaId === userKhoaId;
    }
    return false;
  }

  // Cố vấn theo role hoặc lãnh đạo đang làm CVHT lớp
  if (user.role === ROLES.ACADEMIC_ADVISOR || (await isAdvisorOfSubmissionClass(user, file))) {
    if (!userGiangVienId || !studentLopId) return false;
    const lop = await Lop.findById(studentLopId).select('coVanId isActive').lean();
    if (!lop || lop.isActive === false) return false;
    return idOf(lop.coVanId) === userGiangVienId;
  }

  return false;
};

const loadWorkflowForFile = async (file) => {
  if (!file) return { instance: null, workflow: null };
  let instance = null;
  if (file.workflowInstanceId) {
    instance = await WorkflowInstance.findById(file.workflowInstanceId).select('workflowId currentStepOrder').lean();
  }
  if (!instance && file._id) {
    instance = await WorkflowInstance.findOne({ generatedFileId: file._id })
      .select('workflowId currentStepOrder')
      .lean();
  }
  if (!instance?.workflowId) return { instance, workflow: null };
  const workflow = await Workflow.findById(instance.workflowId).select('steps').lean();
  return { instance, workflow };
};

/**
 * Trợ lý phòng/trung tâm xem được hồ sơ của đúng đơn vị mình:
 * bước kiểm tra của trợ lý, hoặc bước trưởng phòng/GĐ trung tâm cùng đơn vị.
 */
const assistantCanViewOfficeSubmission = async (user, file) => {
  const { instance, workflow } = await loadWorkflowForFile(file);
  const steps = workflow?.steps || [];
  if (steps.some((step) => step.role === user.role && assistantMatchesOfficeUnit(user, step))) {
    return true;
  }
  if (await isSubmissionInAssistantUnitScope(user, file, workflow)) return true;
  const current = steps.find((step) => step.stepOrder === instance?.currentStepOrder);
  if (current && (await userCanHandleWorkflowStep(user, current, file))) return true;
  return false;
};

/** Người nộp, hoặc cán bộ đúng phạm vi khoa/đơn vị. Giảng viên thường không xem hộ hồ sơ. */
export const userCanViewSubmission = async (user, file) => {
  if (!user?.role || !file) return false;
  const uid = idOf(user.id || user._id);
  const ownerId = idOf(file.submittedBy);
  if (uid && ownerId && uid === ownerId) return true;
  if (user.role === ROLES.STUDENT) return false;
  if (user.role === ROLES.PHONG_ASSISTANT || user.role === ROLES.TRUNG_TAM_ASSISTANT) {
    return assistantCanViewOfficeSubmission(user, file);
  }
  return isSubmissionInApproverScope(user, file);
};

/**
 * Tìm user nhận bước quy trình.
 * @param {string|object} stepOrRole — role string hoặc step { role, assigneeDepartment }
 */
export const findUsersForWorkflowStep = async (stepOrRole, file) => {
  const step =
    typeof stepOrRole === 'string' ? { role: stepOrRole, assigneeDepartment: null } : stepOrRole;
  const stepRole = step?.role;
  if (!stepRole) return [];

  let byRole = await User.find({ role: stepRole, isActive: true }).select(
    'email fullName role khoaId boMonId lopId giangVienId department',
  );

  if (isWorkflowOfficeUnitRole(stepRole)) {
    const required = normalizeDepartment(step.assigneeDepartment);
    if (required) {
      byRole = byRole.filter((u) => normalizeDepartment(u.department) === required);
    }
  }

  if (stepRole !== ROLES.ACADEMIC_ADVISOR || !file) {
    return byRole;
  }

  const { lopId: studentLopId } = await resolveSubmitterOrgContext(file);
  if (!studentLopId) return byRole;

  const lop = await Lop.findById(studentLopId).select('coVanId isActive').lean();
  if (!lop?.coVanId || lop.isActive === false) return byRole;

  const advisorUser = await User.findOne({
    giangVienId: lop.coVanId,
    isActive: true,
  }).select('email fullName role khoaId boMonId lopId giangVienId department');

  if (!advisorUser) return byRole;

  // Bước CVHT: ưu tiên đúng cố vấn lớp; vẫn giữ user có role academic_advisor trong phạm vi lọc sau
  const map = new Map(byRole.map((u) => [String(u._id), u]));
  map.set(String(advisorUser._id), advisorUser);
  return [...map.values()];
};

/** Lọc danh sách user nhận email duyệt theo phạm vi hồ sơ (+ đơn vị bước nếu có) */
export const filterUsersBySubmissionScope = async (users, file, step = null) => {
  if (!Array.isArray(users) || !users.length) return [];
  const out = [];
  for (const user of users) {
    if (step && isWorkflowOfficeUnitRole(step.role) && !userMatchesStepUnit(user, step)) {
      continue;
    }
    if (await isSubmissionInApproverScope(user, file, step)) {
      out.push(user);
    }
  }
  return out;
};

/**
 * Danh sách đơn vị (phòng / trung tâm) đang có tài khoản thật trong hệ thống.
 * Nguồn: User.department của các role phòng hoặc trung tâm đang hoạt động.
 */
export const listOfficeUnitsFromUsers = async (unitKind = null) => {
  const roleFilter =
    unitKind === 'phong'
      ? [ROLES.DEPARTMENT_HEAD, ROLES.DEPUTY_DEPARTMENT_HEAD, ROLES.PHONG_ASSISTANT]
      : unitKind === 'trung_tam'
        ? [ROLES.CENTER_DIRECTOR, ROLES.DEPUTY_CENTER_DIRECTOR, ROLES.TRUNG_TAM_ASSISTANT]
        : [
            ROLES.DEPARTMENT_HEAD,
            ROLES.DEPUTY_DEPARTMENT_HEAD,
            ROLES.PHONG_ASSISTANT,
            ROLES.CENTER_DIRECTOR,
            ROLES.DEPUTY_CENTER_DIRECTOR,
            ROLES.TRUNG_TAM_ASSISTANT,
          ];

  const users = await User.find({
    role: { $in: roleFilter },
    isActive: true,
    department: { $nin: [null, ''] },
  })
    .select('fullName email role department')
    .lean();

  const map = new Map();
  for (const u of users) {
    const name = String(u.department || '').trim().replace(/\s+/g, ' ');
    if (!name) continue;
    const key = normalizeDepartment(name);
    if (!map.has(key)) {
      map.set(key, {
        value: name,
        label: name,
        unitKind:
          u.role === ROLES.CENTER_DIRECTOR ||
          u.role === ROLES.DEPUTY_CENTER_DIRECTOR ||
          u.role === ROLES.TRUNG_TAM_ASSISTANT
            ? 'trung_tam'
            : 'phong',
        holders: [],
      });
    }
    const entry = map.get(key);
    entry.holders.push({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
    });
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'vi'));
};

/**
 * Hồ sơ có thuộc đơn vị trợ lý theo dõi không?
 * - Trợ lý khoa: cùng khoaId với SV nộp (từng khoa riêng)
 * - Trợ lý phòng/TT: workflow có bước trưởng/GĐ đúng phòng hoặc trung tâm (User.department)
 */
export const isSubmissionInAssistantUnitScope = async (user, file, workflow) => {
  if (!user?.role || !isAssistantRole(user.role) || !file) return false;

  if (user.role === ROLES.KHOA_ASSISTANT) {
    return isSubmissionInApproverScope(user, file);
  }

  const watchRoles = new Set(getAssistantWatchLeaderRoles(user.role));
  if (!watchRoles.size || !normalizeDepartment(user.department)) return false;

  const steps = workflow?.steps || [];
  return steps.some((step) => watchRoles.has(step.role) && assistantMatchesOfficeUnit(user, step));
};

/** Bước hiện tại có phải bước trưởng mà trợ lý đang theo dõi không? */
export const isWaitingLeaderStepForAssistant = (user, currentStep) => {
  if (!user?.role || !currentStep?.role) return false;
  const watchRoles = getAssistantWatchLeaderRoles(user.role);
  if (!watchRoles.includes(currentStep.role)) return false;
  if (
    user.role === ROLES.PHONG_ASSISTANT ||
    user.role === ROLES.TRUNG_TAM_ASSISTANT
  ) {
    return assistantMatchesOfficeUnit(user, currentStep);
  }
  // Trợ lý khoa: bước trưởng/phó khoa (không gắn phòng ban)
  return true;
};

/** Tìm trợ lý cùng đơn vị để nhắc khi đơn chờ trưởng ký */
export const findAssistantsForLeaderStep = async (step, file) => {
  if (!step?.role) return [];

  let assistantRoles = [];
  if (step.role === ROLES.FACULTY_MANAGER || step.role === ROLES.DEPUTY_FACULTY_MANAGER) {
    assistantRoles = [ROLES.KHOA_ASSISTANT];
  } else if (step.role === ROLES.DEPARTMENT_HEAD || step.role === ROLES.DEPUTY_DEPARTMENT_HEAD) {
    assistantRoles = [ROLES.PHONG_ASSISTANT];
  } else if (step.role === ROLES.CENTER_DIRECTOR || step.role === ROLES.DEPUTY_CENTER_DIRECTOR) {
    assistantRoles = [ROLES.TRUNG_TAM_ASSISTANT];
  }
  if (!assistantRoles.length) return [];

  const users = await User.find({ role: { $in: assistantRoles }, isActive: true }).select(
    'email fullName role khoaId boMonId department',
  );

  const out = [];
  for (const user of users) {
    if (user.role === ROLES.KHOA_ASSISTANT) {
      if (await isSubmissionInApproverScope(user, file)) out.push(user);
      continue;
    }
    if (assistantMatchesOfficeUnit(user, step)) out.push(user);
  }
  return out;
};

