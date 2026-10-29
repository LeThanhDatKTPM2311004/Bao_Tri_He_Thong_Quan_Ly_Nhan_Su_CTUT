import { Router } from 'express';
import * as auditLogController from './auditLog.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ROLES } from '../../config/roles.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', asyncHandler(auditLogController.getAll));
router.get('/entity/:type/:id', asyncHandler(auditLogController.getByEntity));

export default router;
