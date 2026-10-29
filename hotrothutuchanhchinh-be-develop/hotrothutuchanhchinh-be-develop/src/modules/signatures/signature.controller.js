import * as signatureService from './signature.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { auditContextFromReq } from '../auditLogs/auditLog.service.js';

export const getProviders = async (_req, res) => {
  const providers = signatureService.getProviders();
  return successResponse(res, providers);
};

export const sign = async (req, res) => {
  const result = await signatureService.signSubmission(req.params.submissionId, req.user, {
    ...req.body,
    auditContext: auditContextFromReq(req),
  });
  return successResponse(res, result, 'Ký số thành công');
};

export const verify = async (req, res) => {
  const result = await signatureService.verifySignature(req.params.id);
  return successResponse(res, result, 'Xác minh chữ ký thành công');
};

export const listBySubmission = async (req, res) => {
  const list = await signatureService.listSignaturesForFile(req.params.submissionId);
  return successResponse(res, list);
};
