export interface ReportSummary {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  rejected: number;
  overdue: number;
  waiting: number;
  avgProcessingDays: number | null;
  completionRate: number;
  rejectionRate: number;
}

export interface ReportStatusRow {
  status: string;
  label: string;
  count: number;
}

export interface ReportMonthlyPoint {
  month: string;
  requests: number;
  approved: number;
}

export interface ReportProcedureRow {
  name: string;
  value: number;
  completed: number;
  rejected: number;
  percentage: number;
  color?: string;
}

export interface ReportsData {
  summary: ReportSummary;
  byStatus: ReportStatusRow[];
  monthly: ReportMonthlyPoint[];
  byProcedure: ReportProcedureRow[];
  range: {
    from: string | null;
    to: string | null;
  };
}

export interface ReportQueryParams {
  from?: string;
  to?: string;
}

/** Báo cáo thống kê phạm vi đơn vị cho trợ lý */
export interface AssistantReportSummary {
  total: number;
  waitingLeader: number;
  overdue: number;
  dueSoon: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  completionRate: number;
  overdueRate: number;
}

export interface AssistantReportProcedureRow {
  name: string;
  value: number;
  completed: number;
  overdue: number;
  waitingLeader: number;
  percentage: number;
  color?: string;
}

export interface AssistantReportMonthlyPoint {
  month: string;
  requests: number;
  completed: number;
  overdue: number;
}

export interface AssistantReportRemindItem {
  submissionId: string;
  submissionCode: string;
  formName: string;
  submittedBy: string;
  kind: string;
  currentStep?: string;
  deadlineAt?: string | null;
  updatedAt?: string;
}

export interface AssistantReportsData {
  mode: 'assistant';
  scopeLabel: string;
  role: string;
  summary: AssistantReportSummary;
  byStatus: ReportStatusRow[];
  byProcedure: AssistantReportProcedureRow[];
  monthly: AssistantReportMonthlyPoint[];
  topRemind: AssistantReportRemindItem[];
  range: {
    from: string | null;
    to: string | null;
  };
}
