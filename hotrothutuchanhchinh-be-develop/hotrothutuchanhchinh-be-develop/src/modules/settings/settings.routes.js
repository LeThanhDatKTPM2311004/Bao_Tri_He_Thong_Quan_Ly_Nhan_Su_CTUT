import { Router } from 'express';
import * as settingsController from './settings.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ROLES } from '../../config/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/overview', asyncHandler(settingsController.getOverview));

export default router;
