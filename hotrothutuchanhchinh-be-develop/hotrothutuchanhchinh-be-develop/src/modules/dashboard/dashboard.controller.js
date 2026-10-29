import * as dashboardService from './dashboard.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';

export const getStats = async (req, res) => {
  const stats = await dashboardService.getStats(req.user);
  return successResponse(res, stats);
};
