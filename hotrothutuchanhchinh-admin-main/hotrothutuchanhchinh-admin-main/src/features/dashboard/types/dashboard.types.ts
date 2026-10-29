export interface DashboardMonthlyPoint {
  month: string;
  requests: number;
  approved: number;
}

export interface DashboardProcedureSlice {
  name: string;
  value: number;
  percentage: number;
  color?: string;
}

export interface DashboardRecentActivity {
  id: string;
  studentName: string;
  studentId: string;
  formName: string;
  status: 'approved' | 'pending' | 'rejected' | string;
  authType: string;
  updatedAt: string;
}

export interface DashboardStats {
  mode?: 'default' | 'assistant';
  totalSubmissions: number;
  pendingApprovals: number;
  completedThisMonth: number;
  rejectedCount: number;
  totalUsers: number;
  overdueCount?: number;
  dueSoonCount?: number;
  waitingLeader?: number;
  monthly: DashboardMonthlyPoint[];
  byProcedure: DashboardProcedureSlice[];
  recent: DashboardRecentActivity[];
  remindList?: Array<{
    submissionId: string;
    submissionCode: string;
    formName: string;
    submittedBy: string;
    kind: string;
    currentStep?: string;
    isOverdue?: boolean;
    isDueSoon?: boolean;
    updatedAt?: string;
  }>;
}
