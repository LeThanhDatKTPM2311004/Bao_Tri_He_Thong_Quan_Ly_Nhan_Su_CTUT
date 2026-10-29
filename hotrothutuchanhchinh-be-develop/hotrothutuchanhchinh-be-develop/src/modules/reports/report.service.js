import { getWorkflowAggregates } from './aggregators/workflowStats.js';
import * as workflowService from '../workflows/workflow.service.js';

export const getWorkflowPerformance = (query) => getWorkflowAggregates(query);

export const exportReport = async (query) => {
  const stats = await getWorkflowAggregates(query);
  const lines = [
    'Loại,Chỉ số,Giá trị',
    `Tổng quan,Tổng hồ sơ,${stats.summary.total}`,
    `Tổng quan,Chờ xử lý,${stats.summary.pending}`,
    `Tổng quan,Đang xử lý,${stats.summary.inProgress}`,
    `Tổng quan,Đã hoàn thành,${stats.summary.completed}`,
    `Tổng quan,Từ chối,${stats.summary.rejected}`,
    `Tổng quan,Quá hạn,${stats.summary.overdue}`,
    `Tổng quan,Tỷ lệ hoàn thành (%),${stats.summary.completionRate}`,
    `Tổng quan,Tỷ lệ từ chối (%),${stats.summary.rejectionRate}`,
    `Tổng quan,Thời gian xử lý TB (ngày),${stats.summary.avgProcessingDays ?? ''}`,
    '',
    'Trạng thái,Số lượng',
    ...stats.byStatus.map((s) => `${s.label},${s.count}`),
    '',
    'Thủ tục,Tổng,Hoàn thành,Từ chối,Tỷ lệ (%)',
    ...stats.byProcedure.map(
      (p) => `${escapeCsv(p.name)},${p.value},${p.completed},${p.rejected},${p.percentage}`,
    ),
    '',
    'Tháng,Tiếp nhận,Đã duyệt',
    ...stats.monthly.map((m) => `${m.month},${m.requests},${m.approved}`),
  ];
  return `\uFEFF${lines.join('\n')}`;
};

export const getAssistantUnitReport = (user, query) =>
  workflowService.getAssistantUnitReport(user, query);

export const exportAssistantUnitReport = (user, query) =>
  workflowService.exportAssistantUnitReport(user, query);

const escapeCsv = (value) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};
