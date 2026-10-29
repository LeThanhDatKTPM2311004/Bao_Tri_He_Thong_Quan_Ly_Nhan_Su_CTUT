import { Router } from 'express';
import * as reportController from './report.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ASSISTANT_ROLES, ROLES } from '../../config/roles.js';

const router = Router();

router.use(authenticate);

router.get(
  '/assistant-unit',
  authorize(...ASSISTANT_ROLES),
  asyncHandler(reportController.getAssistantUnitReport),
);
router.get(
  '/assistant-unit/export',
  authorize(...ASSISTANT_ROLES),
  asyncHandler(reportController.exportAssistantUnitReport),
);

router.use(authorize(ROLES.ADMIN));
router.get('/workflow-performance', asyncHandler(reportController.getWorkflowPerformance));
router.get('/export', asyncHandler(reportController.exportReport));

export default router;
