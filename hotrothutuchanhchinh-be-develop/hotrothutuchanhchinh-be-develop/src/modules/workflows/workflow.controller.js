import * as workflowService from './workflow.service.js';

import { successResponse } from '../../shared/utils/apiResponse.js';
import { auditContextFromReq } from '../auditLogs/auditLog.service.js';

export const getDefaultConfig = async (_req, res) => {
  const workflow = await workflowService.getDefaultWorkflow();
  return successResponse(res, workflow);
};

export const updateDefaultConfig = async (req, res) => {
  const workflow = await workflowService.updateDefaultWorkflow(req.body.steps);
  return successResponse(res, workflow, 'Cập nhật quy trình thành công');
};

export const getApproverRoles = async (_req, res) => {
  return successResponse(res, await workflowService.getApproverRoleOptions());
};

export const listFormConfigs = async (_req, res) => {
  const forms = await workflowService.listFormWorkflowConfigs();
  return successResponse(res, forms);
};

export const getFormConfig = async (req, res) => {
  const config = await workflowService.getFormWorkflowConfig(
    req.params.formType,
    req.params.formId,
  );
  return successResponse(res, config);
};

export const updateFormConfig = async (req, res) => {
  const config = await workflowService.updateFormWorkflowConfig(
    req.params.formType,
    req.params.formId,
    req.body.steps,
  );
  return successResponse(res, config, 'Cập nhật quy trình cho biểu mẫu thành công');
};

export const getFormApprovalSteps = async (req, res) => {
  const steps = await workflowService.listFormApprovalSteps(req.params.formId);
  return successResponse(res, steps);
};

export const getPending = async (req, res) => {
  const tasks = await workflowService.getPendingTasks(req.user);
  return successResponse(res, tasks);
};

export const getProcessed = async (req, res) => {
  const tasks = await workflowService.getProcessedTasks(req.user);
  return successResponse(res, tasks);
};

export const getAssistantMonitor = async (req, res) => {
  const filter = req.query.filter || 'all';
  const tasks = await workflowService.getAssistantMonitor(req.user, filter);
  return successResponse(res, tasks);
};

export const approve = async (req, res) => {
  const result = await workflowService.approve(
    req.params.fileId,
    req.user,
    req.body,
    auditContextFromReq(req),
  );
  return successResponse(res, result, 'Duyệt hồ sơ thành công');
};

export const bulkProcess = async (req, res) => {
  const result = await workflowService.bulkProcess(
    req.user,
    req.body || {},
    auditContextFromReq(req),
  );
  const msg =
    result.failedCount === 0
      ? `Đã xử lý thành công ${result.successCount} hồ sơ`
      : `Thành công ${result.successCount}/${result.total}, lỗi ${result.failedCount}`;
  return successResponse(res, result, msg);
};

export const reject = async (req, res) => {
  const result = await workflowService.reject(
    req.params.fileId,
    req.user,
    req.body,
    auditContextFromReq(req),
  );
  return successResponse(res, result, 'Từ chối hồ sơ thành công');
};

export const returnToStudent = async (req, res) => {
  const result = await workflowService.returnToStudent(
    req.params.fileId,
    req.user,
    req.body,
    auditContextFromReq(req),
  );
  return successResponse(res, result, 'Trả hồ sơ về sinh viên thành công');
};

export const getHistory = async (req, res) => {
  const history = await workflowService.getHistory(req.params.fileId);
  return successResponse(res, history);
};
