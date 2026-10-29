import { Router } from 'express';
import * as authController from './auth.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authRateLimiter, forgotPasswordRateLimiter, refreshRateLimiter } from '../../shared/middlewares/rateLimiter.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

const router = Router();

router.post('/login', authRateLimiter, asyncHandler(authController.login));
router.post('/google', authRateLimiter, asyncHandler(authController.googleLogin));
router.post('/refresh', refreshRateLimiter, asyncHandler(authController.refresh));
router.post('/logout', authenticate, asyncHandler(authController.logout));
router.get('/me', authenticate, asyncHandler(authController.getMe));
router.post('/forgot-password', forgotPasswordRateLimiter, asyncHandler(authController.forgotPassword));
router.get('/verify-reset-token', asyncHandler(authController.verifyResetToken));
router.post('/reset-password', authRateLimiter, asyncHandler(authController.resetPassword));

export default router;
