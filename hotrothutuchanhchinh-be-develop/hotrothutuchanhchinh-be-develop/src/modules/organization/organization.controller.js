import * as orgService from './organization.service.js';
import { successResponse } from '../../shared/utils/apiResponse.js';
import { HTTP_STATUS } from '../../shared/constants/httpStatus.js';
import { parsePagination } from '../../shared/utils/pagination.js';

const crud = (getFn, createFn, updateFn, deleteFn) => ({
  list: async (req, res) => {
    const pagination = parsePagination(req.query);
    const result = await getFn(req.query, pagination);
    return successResponse(res, result.data, 'Success', HTTP_STATUS.OK, result.meta);
  },
  create: async (req, res) => {
    const doc = await createFn(req.body);
    return successResponse(res, doc, 'Tạo thành công', HTTP_STATUS.CREATED);
  },
  update: async (req, res) => {
    const doc = await updateFn(req.params.id, req.body);
    return successResponse(res, doc, 'Cập nhật thành công');
  },
  remove: async (req, res) => {
    const doc = await deleteFn(req.params.id);
    return successResponse(res, doc, 'Đã chuyển sang ngừng hoạt động');
  },
});

const khoa = crud(orgService.getKhoas, orgService.createKhoa, orgService.updateKhoa, orgService.deleteKhoa);
const boMon = crud(orgService.getBoMons, orgService.createBoMon, orgService.updateBoMon, orgService.deleteBoMon);
const lop = crud(orgService.getLops, orgService.createLop, orgService.updateLop, orgService.deleteLop);
const sinhVien = crud(orgService.getSinhViens, orgService.createSinhVien, orgService.updateSinhVien, orgService.deleteSinhVien);
const giangVien = crud(orgService.getGiangViens, orgService.createGiangVien, orgService.updateGiangVien, orgService.deleteGiangVien);
const quyen = crud(orgService.getQuyens, orgService.createQuyen, orgService.updateQuyen, orgService.deleteQuyen);

export const listKhoas = khoa.list;
export const createKhoa = khoa.create;
export const updateKhoa = khoa.update;
export const deleteKhoa = khoa.remove;

export const listAllKhoas = async (_req, res) => {
  const data = await orgService.getAllKhoas();
  return successResponse(res, data);
};

export const listBoMons = boMon.list;
export const createBoMon = boMon.create;
export const updateBoMon = boMon.update;
export const deleteBoMon = boMon.remove;

export const listLops = lop.list;
export const createLop = lop.create;
export const updateLop = lop.update;
export const deleteLop = lop.remove;

export const listSinhViens = sinhVien.list;
export const createSinhVien = sinhVien.create;
export const updateSinhVien = sinhVien.update;
export const deleteSinhVien = sinhVien.remove;

export const listGiangViens = giangVien.list;
export const createGiangVien = giangVien.create;
export const updateGiangVien = giangVien.update;
export const deleteGiangVien = giangVien.remove;

export const listQuyens = quyen.list;
export const createQuyen = quyen.create;
export const updateQuyen = quyen.update;
export const deleteQuyen = quyen.remove;

export const listAllQuyens = async (_req, res) => {
  const data = await orgService.getAllQuyens();
  return successResponse(res, data);
};

export const listGiangVienQuyens = async (req, res) => {
  const pagination = parsePagination(req.query);
  const result = await orgService.getGiangVienQuyens(req.query, pagination);
  return successResponse(res, result.data, 'Success', HTTP_STATUS.OK, result.meta);
};

export const assignQuyen = async (req, res) => {
  const doc = await orgService.assignGiangVienQuyen(req.body);
  return successResponse(res, doc, 'Gán quyền thành công', HTTP_STATUS.CREATED);
};

export const revokeQuyen = async (req, res) => {
  const doc = await orgService.revokeGiangVienQuyen(req.params.id);
  return successResponse(res, doc, 'Thu hồi quyền thành công');
};

import { ValidationError } from '../../shared/errors/AppError.js';

const importHandler = (fn) => async (req, res) => {
  if (!req.file?.buffer) {
    throw new ValidationError('Chưa upload file Excel');
  }
  const result = await fn(req.file.buffer);
  return successResponse(res, result, 'Import hoàn tất');
};

export const importGiangViens = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ValidationError('Chưa upload file Excel');
  }
  const result = await orgService.importGiangViens(req.file.buffer, {
    khoaId: req.body.khoaId || undefined,
    boMonId: req.body.boMonId || undefined,
  });
  return successResponse(res, result, 'Import hoàn tất');
};

export const importBoMons = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ValidationError('Chưa upload file Excel');
  }
  const result = await orgService.importBoMons(req.file.buffer, {
    khoaId: req.body.khoaId || undefined,
  });
  return successResponse(res, result, 'Import hoàn tất');
};

export const importLops = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ValidationError('Chưa upload file Excel');
  }
  const result = await orgService.importLops(req.file.buffer, {
    khoaId: req.body.khoaId || undefined,
    boMonId: req.body.boMonId || undefined,
  });
  return successResponse(res, result, 'Import hoàn tất');
};

export const importSinhViens = async (req, res) => {
  if (!req.file?.buffer) {
    throw new ValidationError('Chưa upload file Excel');
  }
  const result = await orgService.importSinhViens(req.file.buffer, {
    lopId: req.body.lopId || undefined,
  });
  return successResponse(res, result, 'Import hoàn tất');
};

export const importKhoas = importHandler(orgService.importKhoas);
export const importQuyens = importHandler(orgService.importQuyens);
