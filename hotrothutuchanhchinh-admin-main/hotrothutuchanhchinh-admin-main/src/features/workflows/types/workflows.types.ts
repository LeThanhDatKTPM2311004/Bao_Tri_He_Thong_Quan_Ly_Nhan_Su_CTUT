export interface WorkflowStep {
  stepOrder: number;
  stepName: string;
  /** Vai trò đích (người xử lý bước này) */
  role: string;
  /** Vai trò nguồn — bước trước chuyển tới role; bước 1 thường là sinh viên */
  fromRole?: string;
  /**
   * Đơn vị / phòng / trung tâm (khớp User.department).
   * Bắt buộc với Trưởng/Phó phòng, Giám đốc/Phó GĐ trung tâm.
   */
  assigneeDepartment?: string | null;
  action?: 'review' | 'approve' | 'sign' | 'forward';
  isRequired?: boolean;
  allowReject?: boolean;
  allowReturn?: boolean;
  allowSign?: boolean;
  requiresSignature?: boolean;
  returnTo?: 'student' | 'previous';
  /** Số ngày tối đa từ fromRole → role (không bắt buộc) */
  deadlineDays?: number | null;
}

export interface WorkflowConfig {
  _id: string;
  name: string;
  isDefault?: boolean;
  loaiDonId?: string;
  formId?: string;
  steps: WorkflowStep[];
}

export interface FormWorkflowOption {
  formType: 'word' | 'manual';
  formId: string;
  formName: string;
  hasCustomWorkflow: boolean;
  stepsCount: number;
  code?: string;
  isActive?: boolean;
  sourceType?: string;
}

export interface FormWorkflowConfigResponse {
  formType: 'word' | 'manual';
  formId: string;
  formName: string;
  isUsingDefault: boolean;
  workflow: WorkflowConfig;
}

export interface ApproverUnitOption {
  value: string;
  label: string;
  holders?: { fullName: string; email: string; role: string }[];
}

export interface ApproverRoleOption {
  value: string;
  label: string;
  group?: string;
  groupLabel?: string;
  requiresUnit?: boolean;
  unitKind?: 'phong' | 'trung_tam' | null;
  units?: ApproverUnitOption[];
}

export interface PendingTask {
  _id: string;
  submissionId: string;
  submissionCode: string;
  formName: string;
  submittedBy: string;
  fileUrl?: string;
  fileMimeType?: string;
  currentStep: string;
  currentStepRole?: string;
  currentStepAction?: 'review' | 'approve' | 'sign' | 'forward';
  requiresSignature?: boolean;
  allowSign?: boolean;
  allowReject?: boolean;
  allowReturn?: boolean;
  returnTo?: 'student' | 'previous';
  submittedAt: string;
  /** Số ngày hạn cấu hình cho bước hiện tại */
  deadlineDays?: number | null;
  deadlineAt?: string | null;
  /** Ngày còn lại tới hạn (âm = đã quá); null = không giới hạn */
  daysRemaining?: number | null;
  isOverdue?: boolean;
  trangThai?: string;
}

export interface ProcessedTask extends PendingTask {
  myAction: string;
  myActionAt: string;
  instanceStatus: string;
}

/** Mục theo dõi đơn vị cho trợ lý (chỉ đọc + in) */
export interface AssistantMonitorItem {
  submissionId: string;
  submissionCode: string;
  formName: string;
  submittedBy: string;
  fileUrl?: string;
  kind: 'overdue' | 'due_soon' | 'waiting_leader' | 'in_progress' | 'completed' | 'cancelled' | string;
  instanceStatus: string;
  trangThai?: string;
  currentStep?: string;
  currentStepRole?: string | null;
  deadlineAt?: string | null;
  waitingLeader?: boolean;
  isOverdue?: boolean;
  isDueSoon?: boolean;
  updatedAt?: string;
  completedAt?: string | null;
  canPrint?: boolean;
  canSign?: boolean;
}

/** Hình thức xử lý do tài khoản nội bộ chọn khi duyệt hồ sơ */
export type StaffProcessMode = 'approve' | 'sign' | 'handwritten';

/** Vị trí & kích thước khung chữ ký người dùng chọn trên preview (tỉ lệ theo trang, gốc góc trên-trái) */
export interface SignaturePlacement {
  page: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  heightRatio: number;
}

export interface WorkflowAction {
  /** approve = duyệt thường; sign = ký số; handwritten = ký tay */
  action?: StaffProcessMode;
  comment?: string;
  signature?: {
    provider: string;
    pin?: string;
    smartCaUsername?: string;
    stampImageUrl?: string;
    placement?: SignaturePlacement;
  };
}
