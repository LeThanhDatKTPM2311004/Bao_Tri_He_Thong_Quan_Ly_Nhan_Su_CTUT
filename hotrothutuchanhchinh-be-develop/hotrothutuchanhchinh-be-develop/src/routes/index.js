import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/user.routes.js';
import workflowRoutes from '../modules/workflows/workflow.routes.js';
import notificationRoutes from '../modules/notifications/notification.routes.js';
import dashboardRoutes from '../modules/dashboard/dashboard.routes.js';
import reportRoutes from '../modules/reports/report.routes.js';
import auditLogRoutes from '../modules/auditLogs/auditLog.routes.js';
import organizationRoutes from '../modules/organization/organization.routes.js';
import importFormRoutes from '../modules/importForms/loaidon.route.js';
import convertFileAndSubmitRoutes from '../modules/convertFileAndSubmit/convertFileAndSubmit.route.js';
import signatureRoutes from '../modules/signatures/signature.routes.js';
import settingsRoutes from '../modules/settings/settings.routes.js';
import chatbotRoutes from '../modules/chatbot/chatbot.routes.js';
import mongoose from 'mongoose';
import config from '../config/index.js';
import { getAdminPortalUrl } from '../config/clientUrls.js';
import { blockUntilPasswordChanged } from '../shared/middlewares/requirePasswordChanged.js';
import { apiRateLimiter } from '../shared/middlewares/rateLimiter.js';

const router = Router();

router.get('/health', (_req, res) => {
  const emailProvider = config.brevo.apiKey
    ? 'brevo'
    : config.smtp.host && config.smtp.user && config.smtp.pass
      ? 'smtp'
      : 'none';
  const dbReady = mongoose.connection.readyState === 1;

  res.json({
    success: true,
    message: 'PM_TTHC2 API is running',
    emailProvider,
    db: dbReady ? 'connected' : 'connecting',
    version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'local',
    adminPortalUrl: getAdminPortalUrl(),
  });
});

router.use(apiRateLimiter);
router.use(blockUntilPasswordChanged);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/workflows', workflowRoutes);
router.use('/signatures', signatureRoutes);
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/organization', organizationRoutes);
router.use('/import-forms', importFormRoutes);
router.use('/convert-file-and-submit', convertFileAndSubmitRoutes);
router.use('/settings', settingsRoutes);
router.use('/chatbot', chatbotRoutes);

export default router;
