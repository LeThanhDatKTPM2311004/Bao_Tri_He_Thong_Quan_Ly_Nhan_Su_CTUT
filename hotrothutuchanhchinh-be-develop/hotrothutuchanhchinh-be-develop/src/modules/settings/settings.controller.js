import * as settingsService from './settings.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';

export const getOverview = async (_req, res) => {
  const overview = await settingsService.getOverview();
  return successResponse(res, overview, 'System overview');
};
