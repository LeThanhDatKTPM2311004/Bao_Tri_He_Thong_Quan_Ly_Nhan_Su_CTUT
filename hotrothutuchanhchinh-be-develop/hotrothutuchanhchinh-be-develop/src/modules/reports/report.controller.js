import * as reportService from './report.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';

export const getWorkflowPerformance = async (req, res) => {
  const stats = await reportService.getWorkflowPerformance(req.query);
  return successResponse(res, stats);
};

export const exportReport = async (req, res) => {
  const data = await reportService.exportReport(req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=bao-cao-thong-ke-${stamp}.csv`);
  return res.send(data);
};

export const getAssistantUnitReport = async (req, res) => {
  const stats = await reportService.getAssistantUnitReport(req.user, req.query);
  return successResponse(res, stats);
};

export const exportAssistantUnitReport = async (req, res) => {
  const data = await reportService.exportAssistantUnitReport(req.user, req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=thong-ke-tro-ly-don-vi-${stamp}.csv`,
  );
  return res.send(data);
};
