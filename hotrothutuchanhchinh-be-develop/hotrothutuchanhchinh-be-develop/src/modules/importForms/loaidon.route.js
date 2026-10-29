// [SHARED-BE] Import mẫu Word — admin upload; student FE đọc danh sách/chi tiết
// Cán bộ/admin: tải mẫu Excel + import tạo hồ sơ hàng loạt
import { Router } from 'express';
import multer from 'multer';
import loaiDonController from './loaidon.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ROLES } from '../../config/roles.js';
import { ForbiddenError } from '../../shared/errors/AppError.js';

/** Tạm khóa nhập đơn từ Excel. Đổi thành true để mở lại. */
const BULK_EXCEL_IMPORT_ENABLED = false;

const rejectBulkExcelImport = (_req, _res, next) => {
  if (BULK_EXCEL_IMPORT_ENABLED) return next();
  next(new ForbiddenError('Chức năng nhập đơn từ Excel đang tạm khóa'));
};

const router = Router();
const upload = multer({ dest: 'uploads/' });
const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];

/** Admin + cán bộ (không gồm sinh viên / trợ lý) — khớp menu portal */
const bulkImportRoles = [
  ROLES.ADMIN,
  ROLES.OFFICE_STAFF,
  ROLES.DEPARTMENT_HEAD,
  ROLES.DEPUTY_DEPARTMENT_HEAD,
  ROLES.FACULTY_MANAGER,
  ROLES.DEPUTY_FACULTY_MANAGER,
  ROLES.CENTER_DIRECTOR,
  ROLES.DEPUTY_CENTER_DIRECTOR,
  ROLES.PRINCIPAL,
  ROLES.VICE_PRINCIPAL,
  ROLES.DEPARTMENT_CHAIR,
  ROLES.DEPUTY_DEPARTMENT_CHAIR,
  ROLES.ACADEMIC_ADVISOR,
  ROLES.LECTURER,
  ROLES.STUDENT_AFFAIRS,
  ROLES.FACULTY_ASSISTANT,
];
const staffOrAdminImport = [authenticate, authorize(...bulkImportRoles)];

router.get('/', asyncHandler(loaiDonController.getAll.bind(loaiDonController)));

router.post(
  '/preview',
  authenticate,
  asyncHandler(loaiDonController.previewFile.bind(loaiDonController)),
);

router.get(
  '/:id/download',
  authenticate,
  asyncHandler(loaiDonController.downloadTemplate.bind(loaiDonController)),
);

router.get(
  '/:id/excel-template',
  rejectBulkExcelImport,
  ...staffOrAdminImport,
  asyncHandler(loaiDonController.downloadExcelTemplate.bind(loaiDonController)),
);

router.post(
  '/:id/import-submissions',
  rejectBulkExcelImport,
  ...staffOrAdminImport,
  excelUpload.single('file'),
  asyncHandler(loaiDonController.importSubmissions.bind(loaiDonController)),
);

router.get('/:id', asyncHandler(loaiDonController.getById.bind(loaiDonController)));

router.post(
  '/',
  ...adminOnly,
  upload.single('file'),
  asyncHandler(loaiDonController.import.bind(loaiDonController)),
);
router.put('/:id', ...adminOnly, asyncHandler(loaiDonController.update.bind(loaiDonController)));
router.delete('/:id', ...adminOnly, asyncHandler(loaiDonController.delete.bind(loaiDonController)));

export default router;
