import { Router } from 'express';
import * as notificationController from './notification.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(notificationController.getAll));
router.get('/unread-count', asyncHandler(notificationController.getUnreadCount));
router.patch('/:id/read', asyncHandler(notificationController.markAsRead));
router.patch('/read-all', asyncHandler(notificationController.markAllAsRead));

export default router;
