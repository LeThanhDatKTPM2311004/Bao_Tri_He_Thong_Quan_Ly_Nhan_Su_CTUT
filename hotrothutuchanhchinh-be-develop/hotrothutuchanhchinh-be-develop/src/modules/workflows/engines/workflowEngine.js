const stepOrderOf = (step, index) => {
  const n = Number(step?.stepOrder);
  if (Number.isFinite(n) && n > 0) return n;
  return index + 1;
};

export const getCurrentStepDef = (workflow, currentStepOrder) => {
  const steps = workflow?.steps || [];
  return steps.find((s, i) => stepOrderOf(s, i) === currentStepOrder) ?? null;
};

export const getNextStep = (workflow, instance, action) => {
  if (action === 'reject' || action === 'return') return null;
  const nextOrder = instance.currentStepOrder + 1;
  const next = (workflow?.steps || []).find((s, i) => stepOrderOf(s, i) === nextOrder);
  return next ? { stepOrder: nextOrder, step: next } : null;
};

export const canHandleStep = (stepRole, userRole) =>
  stepRole === userRole || userRole === 'admin';

export const isLastStep = (workflow, currentStepOrder) =>
  !getNextStep(workflow, { currentStepOrder }, 'approve');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Số ngày hạn hợp lệ (>= 1). 0 / null / undefined = không giới hạn. */
export const normalizeDeadlineDays = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const days = Number(value);
  if (!Number.isFinite(days) || days <= 0) return null;
  return Math.min(Math.floor(days), 3650);
};

export const getStepEnteredAt = (instance) => {
  if (!instance) return null;
  if (instance.currentStepEnteredAt) return new Date(instance.currentStepEnteredAt);
  if (instance.startedAt) return new Date(instance.startedAt);
  if (instance.createdAt) return new Date(instance.createdAt);
  return null;
};

export const getStepDeadlineAt = (instance, stepDef) => {
  let effectiveDays = normalizeDeadlineDays(stepDef?.deadlineDays);
  if (effectiveDays == null && stepDef?.slaHours != null) {
    const hours = Number(stepDef.slaHours);
    if (Number.isFinite(hours) && hours > 0) {
      effectiveDays = hours >= 24 ? Math.floor(hours / 24) : hours / 24;
    }
  }
  if (effectiveDays == null || effectiveDays <= 0) return null;
  const entered = getStepEnteredAt(instance);
  if (!entered || Number.isNaN(entered.getTime())) return null;
  return new Date(entered.getTime() + effectiveDays * DAY_MS);
};

export const isPastStepDeadline = (instance, workflow, now = new Date()) => {
  if (!instance || !['in_progress', 'overdue', 'pending'].includes(instance.status)) {
    return false;
  }
  if (instance.currentStepOrder < 1) return false;
  const step = getCurrentStepDef(workflow, instance.currentStepOrder);
  const deadlineAt = getStepDeadlineAt(instance, step);
  if (!deadlineAt) return false;
  return now.getTime() > deadlineAt.getTime();
};
