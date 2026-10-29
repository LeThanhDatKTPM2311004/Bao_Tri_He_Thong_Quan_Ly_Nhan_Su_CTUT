import { Workflow } from '../../modules/workflows/workflow.model.js';

export const seedWorkflows = async () => {
  const exists = await Workflow.findOne({ name: 'Default Approval Workflow' });
  if (exists) {
    console.log('[Seeder] Workflows already exist, skipping');
    return;
  }

  await Workflow.create({
    name: 'Default Approval Workflow',
    steps: [
      { stepOrder: 1, stepName: 'Cố vấn học tập', role: 'academic_advisor', action: 'review' },
      { stepOrder: 2, stepName: 'Trưởng bộ môn', role: 'department_chair', action: 'approve' },
      { stepOrder: 3, stepName: 'Trưởng khoa', role: 'faculty_manager', action: 'sign' },
    ],
    isActive: true,
  });

  console.log('[Seeder] Workflows seeded');
};
