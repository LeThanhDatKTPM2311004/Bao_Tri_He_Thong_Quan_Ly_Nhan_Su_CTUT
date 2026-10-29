import * as auditLogService from './auditLog.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { parsePagination } from '../../shared/utils/pagination.js';

export const getAll = async (req, res) => {
  const pagination = parsePagination(req.query);
  const result = await auditLogService.getAll(req.query, pagination);
  return successResponse(res, result.data, 'Success', 200, result.meta);
};

export const getByEntity = async (req, res) => {
  const logs = await auditLogService.getByEntity(req.params.type, req.params.id);
  return successResponse(res, logs);
};
