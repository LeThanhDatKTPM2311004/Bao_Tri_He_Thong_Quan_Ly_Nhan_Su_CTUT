import { Workflow, WorkflowInstance } from '../../workflows/workflow.model.js';
import LoaiDon from '../../importForms/LoaiDon.model.js';

const PROCEDURE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_LABELS = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  completed: 'Đã hoàn thành',
  rejected: 'Từ chối',
  overdue: 'Quá hạn',
};

const buildDateMatch = (query = {}) => {
  const createdAt = {};
  if (query.from) {
    const from = new Date(query.from);
    if (!Number.isNaN(from.getTime())) createdAt.$gte = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      createdAt.$lte = to;
    }
  }
  return Object.keys(createdAt).length ? { createdAt } : {};
};

const buildLastMonths = (count = 6) => {
  const months = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(-2)}`,
    });
  }
  return months;
};

export const getWorkflowAggregates = async (query = {}) => {
  const dateMatch = buildDateMatch(query);
  const hasDateFilter = Object.keys(dateMatch).length > 0;

  const [byStatusRaw, total, pending, inProgress, completed, rejected, overdue, avgAgg, byProcedureRaw] =
    await Promise.all([
      WorkflowInstance.aggregate([
        ...(hasDateFilter ? [{ $match: dateMatch }] : []),
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { status: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),
      WorkflowInstance.countDocuments(dateMatch),
      WorkflowInstance.countDocuments({ ...dateMatch, status: 'pending' }),
      WorkflowInstance.countDocuments({ ...dateMatch, status: 'in_progress' }),
      WorkflowInstance.countDocuments({ ...dateMatch, status: 'completed' }),
      WorkflowInstance.countDocuments({ ...dateMatch, status: 'rejected' }),
      WorkflowInstance.countDocuments({ ...dateMatch, status: 'overdue' }),
      WorkflowInstance.aggregate([
        {
          $match: {
            ...dateMatch,
            status: 'completed',
          },
        },
        {
          $project: {
            days: {
              $divide: [
                {
                  $subtract: [{ $ifNull: ['$completedAt', '$updatedAt'] }, '$createdAt'],
                },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgDays: { $avg: '$days' },
            count: { $sum: 1 },
          },
        },
      ]),
      WorkflowInstance.aggregate([
        ...(hasDateFilter ? [{ $match: dateMatch }] : []),
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
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            rejected: {
              $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
            },
          },
        },
        { $sort: { value: -1 } },
        { $limit: 10 },
      ]),
    ]);

  const months = buildLastMonths(6);
  const rangeStart = hasDateFilter && dateMatch.createdAt?.$gte
    ? dateMatch.createdAt.$gte
    : new Date(months[0].year, months[0].month - 1, 1);
  const rangeEnd = hasDateFilter && dateMatch.createdAt?.$lte
    ? dateMatch.createdAt.$lte
    : new Date();

  const [createdAgg, approvedAgg] = await Promise.all([
    WorkflowInstance.aggregate([
      {
        $match: {
          createdAt: {
            $gte: rangeStart,
            ...(hasDateFilter && dateMatch.createdAt?.$lte ? { $lte: dateMatch.createdAt.$lte } : {}),
          },
        },
      },
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
            { completedAt: { $gte: rangeStart, ...(dateMatch.createdAt?.$lte ? { $lte: dateMatch.createdAt.$lte } : {}) } },
            {
              completedAt: null,
              updatedAt: {
                $gte: rangeStart,
                ...(dateMatch.createdAt?.$lte ? { $lte: dateMatch.createdAt.$lte } : {}),
              },
            },
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

  const monthly = months.map(({ year, month, label }) => {
    const key = `${year}-${month}`;
    return {
      month: label,
      requests: createdMap.get(key) || 0,
      approved: approvedMap.get(key) || 0,
    };
  });

  const procedureTotal = byProcedureRaw.reduce((sum, row) => sum + row.value, 0) || 1;
  const byProcedure = byProcedureRaw.map((row, index) => ({
    name: row._id,
    value: row.value,
    completed: row.completed,
    rejected: row.rejected,
    percentage: Math.round((row.value / procedureTotal) * 1000) / 10,
    color: PROCEDURE_COLORS[index % PROCEDURE_COLORS.length],
  }));

  const knownStatuses = ['pending', 'in_progress', 'completed', 'rejected', 'overdue'];
  const statusMap = new Map(byStatusRaw.map((row) => [row.status, row.count]));
  const byStatus = knownStatuses.map((status) => ({
    status,
    label: STATUS_LABELS[status] || status,
    count: statusMap.get(status) || 0,
  }));

  const avgDays = avgAgg[0]?.avgDays;
  const completionRate = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  const rejectionRate = total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0;

  return {
    summary: {
      total,
      pending,
      inProgress,
      completed,
      rejected,
      overdue,
      waiting: pending + inProgress + overdue,
      avgProcessingDays: avgDays != null ? Math.round(avgDays * 10) / 10 : null,
      completionRate,
      rejectionRate,
    },
    byStatus,
    monthly,
    byProcedure,
    range: {
      from: dateMatch.createdAt?.$gte?.toISOString?.() || null,
      to: dateMatch.createdAt?.$lte?.toISOString?.() || null,
    },
  };
};
