import { Router } from 'express';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { optionalAuthenticate } from '../../shared/middlewares/optionalAuthenticate.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { ROLES } from '../../config/roles.js';
import * as chatbotController from './chatbot.controller.js';

const router = Router();

router.get('/suggestions', asyncHandler(chatbotController.suggestions));
router.post('/ask', optionalAuthenticate, asyncHandler(chatbotController.ask));

router.get(
  '/admin/suggestions',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(chatbotController.suggestionsAdmin),
);
router.post(
  '/admin/ask',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(chatbotController.askAdmin),
);

export default router;
