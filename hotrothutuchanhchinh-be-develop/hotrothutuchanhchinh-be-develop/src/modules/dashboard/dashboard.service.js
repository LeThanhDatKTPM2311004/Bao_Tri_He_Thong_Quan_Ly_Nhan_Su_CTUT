import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import LoaiDon from '../importForms/LoaiDon.model.js';
import User from '../users/user.model.js';
import { Workflow, WorkflowInstance } from '../workflows/workflow.model.js';
import { isAssistantRole } from '../../config/roles.js';
import * as workflowService from '../workflows/workflow.service.js';

const STATUS_UI = {
  completed: 'approved',
  rejected: 'rejected',
  pending: 'pending',
  in_progress: 'pending',
  overdue: 'pending',
};

const actionLabel = (action) => {
  if (action === 'sign') return 'Đã ký số';
  if (action === 'approve') return 'Đã phê duyệt';
  if (action === 'reject') return 'Từ chối';
  if (action === 'review') return 'Đã xem xét';
  if (action === 'forward') return 'Chuyển tiếp';
  return 'Đang xử lý';
};

const PROCEDURE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const buildLastSixMonths = () => {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `T${d.getMonth() + 1}`,
    });
  }
  return months;
};

const getMonthlyStats = async () => {
  const months = buildLastSixMonths();
  const rangeStart = new Date(months[0].year, months[0].month - 1, 1);

  const [createdAgg, approvedAgg] = await Promise.all([
    WorkflowInstance.aggregate([
      { $match: { createdAt: { $gte: rangeStart } } },
      {
        $group: {
          _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
    WorkflowInstance.aggregate([
      {
        $match: {
          status: 'completed',
          $or: [
            { completedAt: { $gte: rangeStart } },
            { completedAt: null, updatedAt: { $gte: rangeStart } },
          ],
        },
      },
      {
        $addFields: {
          approvedAt: { $ifNull: ['$completedAt', '$updatedAt'] },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$approvedAt' }, month: { $month: '$approvedAt' } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const createdMap = new Map(
    createdAgg.map((row) => [`${row._id.year}-${row._id.month}`, row.count]),
  );
  const approvedMap = new Map(
    approvedAgg.map((row) => [`${row._id.year}-${row._id.month}`, row.count]),
  );

  return months.map(({ year, month, label }) => {
    const key = `${year}-${month}`;
    return {
      month: label,
      requests: createdMap.get(key) || 0,
      approved: approvedMap.get(key) || 0,
    };
  });
};

const getByProcedure = async () => {
  const rows = await WorkflowInstance.aggregate([
    {
      $lookup: {
        from: Workflow.collection.name,
        localField: 'workflowId',
        foreignField: '_id',
        as: 'workflow',
      },
    },
    { $unwind: { path: '$workflow', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: LoaiDon.collection.name,
        localField: 'workflow.loaiDonId',
        foreignField: '_id',
        as: 'loaiDon',
      },
    },
    { $unwind: { path: '$loaiDon', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$loaiDon.tenDon', 'Không xác định'] },
        value: { $sum: 1 },
      },
    },
    { $sort: { value: -1 } },
    { $limit: 6 },
  ]);

  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;

  return rows.map((row, index) => ({
    name: row._id,
    value: row.value,
    percentage: Math.round((row.value / total) * 1000) / 10,
    color: PROCEDURE_COLORS[index % PROCEDURE_COLORS.length],
  }));
};

const getRecentActivities = async (limit = 8) => {
  const rows = await WorkflowInstance.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate({
      path: 'generatedFileId',
      model: GeneratedFile,
      select: 'tenDon tenNguoiGui submittedBy trangThai',
      populate: { path: 'submittedBy', model: User, select: 'fullName studentId' },
    })
    .lean();

  return rows.map((inst) => {
    const file = inst.generatedFileId;
    const submitter = file?.submittedBy;
    const handled = [...(inst.steps || [])].reverse().find((step) => step?.action);
    return {
      id: String(inst._id),
      studentName: submitter?.fullName || file?.tenNguoiGui || 'Không rõ',
      studentId: submitter?.studentId || '',
      formName: file?.tenDon || 'Hồ sơ hành chính',
      status: STATUS_UI[inst.status] || 'pending',
      authType: actionLabel(handled?.action),
      updatedAt: inst.updatedAt || inst.createdAt,
    };
  });
};

export const getStats = async (user) => {
  if (user && isAssistantRole(user.role)) {
    const assistant = await workflowService.getAssistantDashboardStats(user);
    return {
      mode: 'assistant',
      totalSubmissions: assistant.totalInScope,
      pendingApprovals: assistant.waitingLeader,
      completedThisMonth: assistant.completedThisMonth,
      rejectedCount: 0,
      totalUsers: 0,
      overdueCount: assistant.overdue,
      dueSoonCount: assistant.dueSoon,
      waitingLeader: assistant.waitingLeader,
      monthly: [],
      byProcedure: [],
      recent: (assistant.remindList || []).map((item) => ({
        id: item.submissionId,
        studentName: item.submittedBy,
        studentId: '',
        formName: item.formName,
        status: item.isOverdue ? 'rejected' : item.isDueSoon ? 'pending' : 'pending',
        authType: item.isOverdue
          ? 'Quá hạn — cần nhắc'
          : item.isDueSoon
            ? 'Sắp quá hạn — cần nhắc'
            : 'Chờ trưởng ký',
        updatedAt: item.updatedAt,
        kind: item.kind,
        submissionCode: item.submissionCode,
      })),
      remindList: assistant.remindList,
    };
  }

  const [total, pending, completed, rejected, totalUsers, monthly, byProcedure, recent] =
    await Promise.all([
      WorkflowInstance.countDocuments(),
      WorkflowInstance.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
      WorkflowInstance.countDocuments({ status: 'completed' }),
      WorkflowInstance.countDocuments({ status: 'rejected' }),
      User.countDocuments({ isActive: { $ne: false } }),
      getMonthlyStats(),
      getByProcedure(),
      getRecentActivities(8),
    ]);

  return {
    mode: 'default',
    totalSubmissions: total,
    pendingApprovals: pending,
    completedThisMonth: completed,
    rejectedCount: rejected,
    totalUsers,
    monthly,
    byProcedure,
    recent,
  };
};
