import { Router } from 'express';

import * as workflowController from './workflow.controller.js';

import { authenticate } from '../../shared/middlewares/authenticate.js';

import { authorize } from '../../shared/middlewares/authorize.js';

import { asyncHandler } from '../../shared/utils/asyncHandler.js';

import { ROLES } from '../../config/roles.js';

const router = Router();

router.use(authenticate);

router.get('/config/default', asyncHandler(workflowController.getDefaultConfig));

router.put('/config/default', authorize(ROLES.ADMIN), asyncHandler(workflowController.updateDefaultConfig));

router.get('/config/approver-roles', asyncHandler(workflowController.getApproverRoles));

router.get('/config/forms', authorize(ROLES.ADMIN), asyncHandler(workflowController.listFormConfigs));

router.get(
  '/config/forms/:formType/:formId',
  authorize(ROLES.ADMIN),
  asyncHandler(workflowController.getFormConfig),
);

router.put(
  '/config/forms/:formType/:formId',
  authorize(ROLES.ADMIN),
  asyncHandler(workflowController.updateFormConfig),
);

router.get('/forms/:formId/steps', asyncHandler(workflowController.getFormApprovalSteps));

router.get('/pending', asyncHandler(workflowController.getPending));

router.get('/processed', asyncHandler(workflowController.getProcessed));

router.get('/assistant-monitor', asyncHandler(workflowController.getAssistantMonitor));

router.post('/bulk/process', asyncHandler(workflowController.bulkProcess));

router.post('/:fileId/approve', asyncHandler(workflowController.approve));

router.post('/:fileId/reject', asyncHandler(workflowController.reject));

router.post('/:fileId/return', asyncHandler(workflowController.returnToStudent));

router.get('/:fileId/history', asyncHandler(workflowController.getHistory));

export default router;
