import {
  getCurrentStepDef,
  getNextStep,
  isLastStep,
} from '../../src/modules/workflows/engines/workflowEngine.js';

describe('workflowEngine — 1 bước (chỉ trưởng khoa)', () => {
  const workflow = {
    steps: [{ stepOrder: 1, stepName: 'Trưởng khoa', role: 'faculty_manager' }],
  };

  test('bước 1 là bước hiện tại', () => {
    expect(getCurrentStepDef(workflow, 1)?.role).toBe('faculty_manager');
  });

  test('ký bước 1 là bước cuối — không còn bước sau', () => {
    expect(isLastStep(workflow, 1)).toBe(true);
    expect(getNextStep(workflow, { currentStepOrder: 1 }, 'approve')).toBeNull();
  });

  test('không bịa bước 2', () => {
    expect(getCurrentStepDef(workflow, 2)).toBeNull();
  });
});

describe('workflowEngine — nhiều bước', () => {
  const workflow = {
    steps: [
      { stepOrder: 1, stepName: 'Cố vấn học tập', role: 'academic_advisor' },
      { stepOrder: 2, stepName: 'Trưởng bộ môn', role: 'department_chair' },
      { stepOrder: 3, stepName: 'Trưởng khoa', role: 'faculty_manager' },
    ],
  };

  test('approve bước 1 chuyển tới cố vấn → trưởng bộ môn', () => {
    const next = getNextStep(workflow, { currentStepOrder: 1 }, 'approve');
    expect(next.stepOrder).toBe(2);
    expect(next.step.role).toBe('department_chair');
    expect(isLastStep(workflow, 1)).toBe(false);
  });

  test('approve bước cuối hoàn tất', () => {
    expect(isLastStep(workflow, 3)).toBe(true);
    expect(getNextStep(workflow, { currentStepOrder: 3 }, 'approve')).toBeNull();
  });

  test('reject không đi bước tiếp', () => {
    expect(getNextStep(workflow, { currentStepOrder: 1 }, 'reject')).toBeNull();
  });
});

describe('workflowEngine — bước thiếu stepOrder (dữ liệu cũ)', () => {
  const workflow = {
    steps: [
      { role: 'academic_advisor', stepName: 'Cố vấn học tập' },
      { role: 'faculty_manager', stepName: 'Trưởng khoa' },
    ],
  };

  test('vẫn nhận bước 1 / 2 theo vị trí', () => {
    expect(getCurrentStepDef(workflow, 1)?.role).toBe('academic_advisor');
    expect(getCurrentStepDef(workflow, 2)?.role).toBe('faculty_manager');
  });

  test('không hoàn tất nhầm sau bước 1', () => {
    expect(isLastStep(workflow, 1)).toBe(false);
    expect(getNextStep(workflow, { currentStepOrder: 1 }, 'approve')?.step.role).toBe(
      'faculty_manager',
    );
  });

  test('bước 2 mới là bước cuối', () => {
    expect(isLastStep(workflow, 2)).toBe(true);
  });
});
