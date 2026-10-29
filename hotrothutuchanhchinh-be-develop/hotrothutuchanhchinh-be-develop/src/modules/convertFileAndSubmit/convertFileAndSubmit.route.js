// [SHARED-BE] Routes convert/preview/generate — student FE + admin portal
import { Router } from 'express';
import multer from 'multer';
import convertFileAndSubmitController from './convertFileAndSubmit.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { optionalAuthenticate } from '../../shared/middlewares/optionalAuthenticate.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const uploadSignatures = upload.fields([
  { name: 'CHU_KY_PH', maxCount: 1 },
  { name: 'CHU_KY_SV', maxCount: 1 },
]);

router.get('/view-file', authenticate, asyncHandler(convertFileAndSubmitController.viewFile));

// [STUDENT-FE] Preview/generate: JWT nếu có; hỗ trợ upload chữ ký PH + SV
router.post(
  '/preview',
  optionalAuthenticate,
  uploadSignatures,
  asyncHandler(convertFileAndSubmitController.previewFile),
);
router.post(
  '/generate',
  optionalAuthenticate,
  uploadSignatures,
  asyncHandler(convertFileAndSubmitController.generateFile),
);

router.post(
  '/submit-filled',
  authenticate,
  upload.single('file'),
  asyncHandler(convertFileAndSubmitController.submitFilled),
);

router.get('/', authenticate, asyncHandler(convertFileAndSubmitController.getAll));
router.get('/:id/progress', authenticate, asyncHandler(convertFileAndSubmitController.getProgress));
router.post('/:id/cancel', authenticate, asyncHandler(convertFileAndSubmitController.cancel));
router.get('/:id', authenticate, asyncHandler(convertFileAndSubmitController.getById));

export default router;
