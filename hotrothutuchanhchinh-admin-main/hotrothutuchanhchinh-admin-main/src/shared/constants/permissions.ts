export const PERMISSIONS = {
  SUBMISSION_CREATE: 'submission:create',
  SUBMISSION_VIEW_OWN: 'submission:view:own',
  SUBMISSION_VIEW_ALL: 'submission:view:all',
  WORKFLOW_APPROVE: 'workflow:approve',
  WORKFLOW_REJECT: 'workflow:reject',
  SIGNATURE_SIGN: 'signature:sign',
  USER_MANAGE: 'user:manage',
  REPORT_VIEW: 'report:view',
  AUDIT_VIEW: 'audit:view',
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
