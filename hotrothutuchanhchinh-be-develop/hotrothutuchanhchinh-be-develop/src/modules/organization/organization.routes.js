import { Router } from 'express';
import multer from 'multer';
import * as ctrl from './organization.controller.js';
import { authenticate } from '../../shared/middlewares/authenticate.js';
import { authorize } from '../../shared/middlewares/authorize.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { ROLES } from '../../config/roles.js';

const router = Router();
const adminOnly = [authenticate, authorize(ROLES.ADMIN)];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const mountCrud = (path, list, create, update, remove, importFn) => {
  router.get(`/${path}`, ...adminOnly, asyncHandler(list));
  router.post(`/${path}`, ...adminOnly, asyncHandler(create));
  router.put(`/${path}/:id`, ...adminOnly, asyncHandler(update));
  router.delete(`/${path}/:id`, ...adminOnly, asyncHandler(remove));
  if (importFn) {
    router.post(`/${path}/import`, ...adminOnly, upload.single('file'), asyncHandler(importFn));
  }
};

router.get('/khoas/all', ...adminOnly, asyncHandler(ctrl.listAllKhoas));
mountCrud('khoas', ctrl.listKhoas, ctrl.createKhoa, ctrl.updateKhoa, ctrl.deleteKhoa, ctrl.importKhoas);
mountCrud('bo-mons', ctrl.listBoMons, ctrl.createBoMon, ctrl.updateBoMon, ctrl.deleteBoMon, ctrl.importBoMons);
mountCrud('lops', ctrl.listLops, ctrl.createLop, ctrl.updateLop, ctrl.deleteLop, ctrl.importLops);
mountCrud('sinh-viens', ctrl.listSinhViens, ctrl.createSinhVien, ctrl.updateSinhVien, ctrl.deleteSinhVien, ctrl.importSinhViens);
mountCrud('giang-viens', ctrl.listGiangViens, ctrl.createGiangVien, ctrl.updateGiangVien, ctrl.deleteGiangVien, ctrl.importGiangViens);

router.get('/quyens/all', ...adminOnly, asyncHandler(ctrl.listAllQuyens));
mountCrud('quyens', ctrl.listQuyens, ctrl.createQuyen, ctrl.updateQuyen, ctrl.deleteQuyen, ctrl.importQuyens);

router.get('/giang-vien-quyens', ...adminOnly, asyncHandler(ctrl.listGiangVienQuyens));
router.post('/giang-vien-quyens', ...adminOnly, asyncHandler(ctrl.assignQuyen));
router.delete('/giang-vien-quyens/:id', ...adminOnly, asyncHandler(ctrl.revokeQuyen));

export default router;
