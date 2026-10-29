import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { WorkflowInstance } from './workflow.model.js';
import * as workflowRepository from './workflow.repository.js';
import { isPastStepDeadline } from './engines/workflowEngine.js';
import * as workflowNotification from '../notifications/workflowNotification.service.js';

/**
 * Đánh dấu instance + đơn là quá hạn nếu bước hiện tại vượt deadlineDays.
 * Vẫn cho phép cán bộ duyệt tiếp sau đó.
 */
export const applyOverdueIfNeeded = async (instance, workflow) => {
  if (!instance || !workflow) return instance;
  if (!['in_progress', 'overdue'].includes(instance.status)) return instance;
  if (!isPastStepDeadline(instance, workflow)) return instance;

  const wasOverdue = instance.status === 'overdue';

  if (instance.status !== 'overdue') {
    instance.status = 'overdue';
    await instance.save();
  }

  const fileId = instance.generatedFileId?._id || instance.generatedFileId;
  if (!fileId) return instance;

  const currentTrangThai = instance.generatedFileId?.trangThai
    || (await GeneratedFile.findById(fileId).select('trangThai'))?.trangThai;

  if (currentTrangThai === 'cho_duyet' || currentTrangThai === 'tre_han') {
    if (currentTrangThai !== 'tre_han') {
      await workflowRepository.updateGeneratedFileStatus(fileId, 'tre_han', {
        currentStepOrder: instance.currentStepOrder,
      });
    }
    if (instance.generatedFileId && typeof instance.generatedFileId === 'object') {
      instance.generatedFileId.trangThai = 'tre_han';
    }
  }

  if (!wasOverdue) {
    workflowNotification.notifyOverdueInApp(instance, workflow).catch((err) => {
      console.error('[Workflow] Overdue notification failed:', err.message);
    });
  }

  return instance;
};

/** Quét các hồ sơ đang xử lý / đã quá hạn để cập nhật trạng thái tre_han. */
export const scanAndMarkOverdueWorkflows = async () => {
  const instances = await WorkflowInstance.find({
    status: { $in: ['in_progress', 'overdue'] },
    currentStepOrder: { $gte: 1 },
  })
    .populate('workflowId')
    .populate('generatedFileId')
    .limit(500);

  let marked = 0;
  for (const instance of instances) {
    const workflow = instance.workflowId;
    if (!workflow) continue;
    const before = instance.status;
    await applyOverdueIfNeeded(instance, workflow);
    if (before !== 'overdue' && instance.status === 'overdue') marked += 1;
  }
  return { checked: instances.length, marked };
};

export const startOverdueScanner = (intervalMs = 15 * 60 * 1000) => {
  const run = () => {
    scanAndMarkOverdueWorkflows()
      .then((result) => {
        if (result.marked > 0) {
          console.log(
            `[Workflow] Overdue scan: checked=${result.checked}, newlyMarked=${result.marked}`,
          );
        }
      })
      .catch((err) => {
        console.error('[Workflow] Overdue scan failed:', err.message);
      });
  };

  setTimeout(run, 30_000);
  return setInterval(run, intervalMs);
};
