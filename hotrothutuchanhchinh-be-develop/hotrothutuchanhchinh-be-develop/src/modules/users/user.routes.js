import { Router } from 'express';
import * as userController from './user.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ROLES } from '../../config/roles.js';
import { avatarUpload } from './user.upload.js';

const router = Router();

router.use(authenticate);

router.get('/me', asyncHandler(userController.getMe));
router.get('/me/student-profile', asyncHandler(userController.getMyStudentProfile));
router.patch('/me/student-profile', asyncHandler(userController.updateMyStudentProfile));
router.patch('/me', asyncHandler(userController.updateMe));
router.patch('/me/password', asyncHandler(userController.changeMyPassword));
router.post('/me/google/link', asyncHandler(userController.linkMyGoogle));
router.delete('/me/google/link', asyncHandler(userController.unlinkMyGoogle));
router.post('/me/avatar', avatarUpload.single('avatar'), asyncHandler(userController.uploadMyAvatar));
router.delete('/me/avatar', asyncHandler(userController.deleteMyAvatar));
router.post(
  '/me/signature-image',
  avatarUpload.single('signature'),
  asyncHandler(userController.uploadMySignatureImage),
);
router.delete('/me/signature-image', asyncHandler(userController.deleteMySignatureImage));
router.post('/me/smartca/verify', asyncHandler(userController.verifyMySmartCa));
router.delete('/me/smartca', asyncHandler(userController.unlinkMySmartCa));
router.get('/', authorize(ROLES.ADMIN), asyncHandler(userController.getAll));
router.get('/:id/advisor-duty', authorize(ROLES.ADMIN), asyncHandler(userController.getAdvisorDuty));
router.put('/:id/advisor-duty', authorize(ROLES.ADMIN), asyncHandler(userController.assignAdvisorDuty));
router.get('/:id', asyncHandler(userController.getById));
router.post('/', authorize(ROLES.ADMIN), asyncHandler(userController.create));
router.put('/:id', authorize(ROLES.ADMIN), asyncHandler(userController.update));
router.patch('/:id/status', authorize(ROLES.ADMIN), asyncHandler(userController.updateStatus));
router.delete('/:id', authorize(ROLES.ADMIN), asyncHandler(userController.remove));

export default router;
