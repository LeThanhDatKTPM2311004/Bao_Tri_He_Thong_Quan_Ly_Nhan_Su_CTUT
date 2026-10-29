import { Router } from 'express';
import * as dashboardController from './dashboard.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

const router = Router();

router.use(authenticate);
router.get('/stats', asyncHandler(dashboardController.getStats));

export default router;
