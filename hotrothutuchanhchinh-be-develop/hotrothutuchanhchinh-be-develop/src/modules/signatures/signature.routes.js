import { Router } from 'express';
import * as signatureController from './signature.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/providers', asyncHandler(signatureController.getProviders));
router.post('/:submissionId/sign', asyncHandler(signatureController.sign));
router.get('/:submissionId/list', asyncHandler(signatureController.listBySubmission));
router.post('/:id/verify', asyncHandler(signatureController.verify));

export default router;
