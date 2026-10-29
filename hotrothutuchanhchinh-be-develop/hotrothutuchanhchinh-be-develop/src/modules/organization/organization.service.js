import Khoa from './models/khoa.model.js';
import BoMon from './models/boMon.model.js';
import Lop from './models/lop.model.js';
import SinhVien from './models/sinhVien.model.js';
import GiangVien from './models/giangVien.model.js';
import Quyen, { QUYEN_CATALOG, QUYEN_GROUPS } from './models/quyen.model.js';
import GiangVienQuyen from './models/giangVienQuyen.model.js';
import User from '../users/user.model.js';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js';
import {
  assertNonBlankText,
  assertMaxLength,
  assertMaxLengthOrgCode,
  assertValidAcademicYear,
  assertValidOrgCode,
  assertValidOrgName,
  normalizeOrgCode,
} from '../../shared/validators/organizationText.js';
import { assertValidKhoaCode, assertValidKhoaName } from '../../shared/validators/khoaText.js';
import { assertCtutEmail, assertStandardEmail } from '../../shared/validators/ctutEmail.js';
import { assertValidPhoneIfProvided } from '../../shared/validators/phoneText.js';
import { normalizeSinhVienIdentityFields } from '../../shared/validators/identityText.js';
import { assertUniqueOrgEmail } from './orgEmail.js';
import { syncUserFromGiangVien, syncUserFromSinhVien, bulkSyncStudentUsers, deactivateUserLinkedToOrg } from './orgUserSync.service.js';
import {
  generateBoMonCode,
  generateGiangVienMa,
  generateKhoaCode,
  generateLopCode,
  generateMaHoSo,
  generateQuyenCode,
  generateSinhVienMa,
  removeDiacritics,
  resolveImportCode,
} from './orgCodeGenerate.js';
import { buildPaginationMeta } from '../../shared/utils/pagination.js';
import { buildAccentInsensitiveOrFilter } from '../../shared/utils/vietnameseSearch.js';
import {
  cell,
  escapeRegex,
  findEntityByNormalizedName,
  giangVienRowFields,
  isEmptyRow,
  khoaFields,
  mapHasAnyKey,
  normalizeText,
  parseExcelRows,
  normalizeImportPhone,
  sinhVienRowFields,
  toRowMap,
} from './importRowUtils.js';

const parseRows = (buffer) => parseExcelRows(buffer);

const pushImportError = (results, row, code, message, detail) => {
  results.errors.push({ row, code, message, ...(detail ? { detail } : {}) });
};

const paginate = async (Model, filter, pagination, populate = []) => {
  let query = Model.find(filter);
  populate.forEach((p) => { query = query.populate(p); });
  const [data, total] = await Promise.all([
    query.clone().skip(pagination.skip).limit(pagination.limit).sort({ createdAt: -1 }),
    Model.countDocuments(filter),
  ]);
  return { data, meta: buildPaginationMeta(total, pagination.page, pagination.limit) };
};

const softDelete = async (Model, id, blockMessage, countFn) => {
  const doc = await Model.findById(id);
  if (!doc) throw new NotFoundError('Không tìm thấy bản ghi');
  if (countFn) {
    const count = await countFn(id);
    if (count > 0) throw new ValidationError(blockMessage);
  }
  doc.isActive = false;
  await doc.save();
  return doc;
};

// ─── Khoa ───
export const getKhoas = (query, pagination) => {
  const filter = { isActive: query.isActive === 'false' ? false : query.isActive === 'all' ? undefined : true };
  if (filter.isActive === undefined) delete filter.isActive;
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['name', 'code'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  return paginate(Khoa, filter, pagination);
};

export const getAllKhoas = () => Khoa.find({ isActive: true }).sort({ name: 1 });

export const createKhoa = async (data) => {
  assertNonBlankText(data.name, 'Tên khoa');
  const name = data.name.trim();
  assertMaxLength(name, 'Tên khoa');
  assertValidKhoaName(name);
  const code = await generateKhoaCode(name);
  assertValidKhoaCode(code);
  assertMaxLengthOrgCode(code, 'Mã khoa');
  return Khoa.create({ ...data, code, name });
};

export const updateKhoa = async (id, data) => {
  const payload = { ...data };
  delete payload.code; // mã hệ thống — không cho sửa
  if (payload.name != null) {
    assertNonBlankText(payload.name, 'Tên khoa');
    payload.name = payload.name.trim();
    assertMaxLength(payload.name, 'Tên khoa');
    assertValidKhoaName(payload.name);
  }
  const doc = await Khoa.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!doc) throw new NotFoundError('Không tìm thấy khoa');
  if (payload.name != null) {
    await User.updateMany({ khoaId: id }, { $set: { faculty: payload.name } });
  }
  return doc;
};

export const deleteKhoa = (id) =>
  softDelete(
    Khoa,
    id,
    'Không thể ngừng hoạt động khoa đang có bộ môn đang hoạt động',
    (khoaId) => BoMon.countDocuments({ khoaId, isActive: true }),
  );

export const importKhoas = async (buffer) => {
  const { rows, detectedHeaders, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [], detectedHeaders, headerRow };

  const headerStr = detectedHeaders.map((h) => String(h).toLowerCase()).join(' ');
  if (/ma sv|masv|ma gv|magv|ho ten|hoten|lop|ngay sinh|email/.test(headerStr)) {
    pushImportError(results, headerRow, 'WRONG_FILE', 'File không đúng loại dữ liệu');
    return results;
  }

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;
    const { code: rawCode, name } = khoaFields(map, detectedHeaders);
    if (!name) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu tên khoa');
      continue;
    }
    try {
      const trimmedName = name.trim();
      assertValidKhoaName(trimmedName);
      assertMaxLength(trimmedName, 'Tên khoa');
      let trimmedCode;
      if (rawCode) {
        trimmedCode = await resolveImportCode(rawCode, () => generateKhoaCode(trimmedName));
      } else {
        const existing = findEntityByNormalizedName(
          await Khoa.find({}).select('code name').lean(),
          trimmedName,
        );
        trimmedCode = existing?.code || (await generateKhoaCode(trimmedName));
      }
      assertValidKhoaCode(trimmedCode);
      assertMaxLengthOrgCode(trimmedCode, 'Mã khoa');
      await Khoa.findOneAndUpdate(
        { code: trimmedCode },
        {
          code: trimmedCode,
          name: trimmedName,
          description: cell(map, 'description', 'moTa', 'mota', 'mo ta', 'Mô tả'),
          isActive: true,
        },
        { upsert: true, new: true },
      );
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }

  if (results.success === 0 && results.errors.length > 1) {
    const firstMsg = results.errors[0].message;
    if (results.errors.every((e) => e.message === firstMsg)) {
      results.errors = [{ row: results.errors[0].row, message: `${firstMsg} (${results.errors.length} dòng)` }];
    }
  }

  return results;
};

// ─── Bộ môn ───
export const getBoMons = (query, pagination) => {
  const filter = {};
  if (query.khoaId) filter.khoaId = query.khoaId;
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['name', 'code'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  return paginate(BoMon, filter, pagination, [{ path: 'khoaId', select: 'code name' }]);
};

export const createBoMon = async (data) => {
  const khoa = await Khoa.findById(data.khoaId);
  if (!khoa) throw new ValidationError('Khoa không tồn tại');
  assertNonBlankText(data.name, 'Tên bộ môn');
  const name = String(data.name).trim();
  const code = await generateBoMonCode(name, khoa._id);
  return BoMon.create({ ...data, code, name });
};

export const updateBoMon = async (id, data) => {
  const payload = { ...data };
  delete payload.code;
  const doc = await BoMon.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    .populate('khoaId', 'code name');
  if (!doc) throw new NotFoundError('Không tìm thấy bộ môn');
  if (data?.name != null) {
    await User.updateMany({ boMonId: id }, { $set: { department: String(data.name).trim() } });
  }
  return doc;
};

export const deleteBoMon = async (id) => {
  const doc = await BoMon.findById(id);
  if (!doc) throw new NotFoundError('Không tìm thấy bộ môn');

  const [lopCount, gvCount] = await Promise.all([
    Lop.countDocuments({ boMonId: id, isActive: true }),
    GiangVien.countDocuments({ boMonId: id, isActive: true }),
  ]);

  if (lopCount > 0 || gvCount > 0) {
    const parts = [];
    if (lopCount > 0) parts.push(`${lopCount} lớp`);
    if (gvCount > 0) parts.push(`${gvCount} giảng viên`);
    throw new ValidationError(
      `Không thể ngừng hoạt động bộ môn còn ${parts.join(' và ')} đang hoạt động. Hãy ngừng hoặc chuyển trước.`,
    );
  }

  doc.isActive = false;
  await doc.save();
  return doc;
};

export const importBoMons = async (buffer, defaults = {}) => {
  const { rows, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [] };

  let defaultKhoa = null;
  if (defaults.khoaId) {
    defaultKhoa = await Khoa.findOne({ _id: defaults.khoaId, isActive: true });
  }

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;
    const khoaCode = cell(map, 'khoaCode', 'maKhoa', 'makhoa', 'ma khoa', 'Mã khoa').toUpperCase();
    const khoaName = cell(map, 'tenKhoa', 'ten khoa', 'Tên khoa', 'khoa', 'Khoa');
    const rawCode = cell(map, 'code', 'mabomon', 'ma bo mon', 'Mã bộ môn', 'MaBoMon', 'Ma bo mon');
    const name = cell(map, 'name', 'ten', 'tenbomon', 'ten bo mon', 'Tên bộ môn', 'TenBoMon', 'Ten bo mon', 'Tên');
    const description = cell(map, 'description', 'moTa', 'mota', 'mo ta', 'Mô tả');

    let khoa = defaultKhoa;
    if (!khoa && khoaCode) {
      khoa = await Khoa.findOne({ code: khoaCode, isActive: true });
    }
    if (!khoa && khoaName) {
      const khoas = await Khoa.find({ isActive: true });
      khoa = findEntityByNormalizedName(khoas, khoaName);
    }

    if (!khoa) {
      pushImportError(results, headerRow + i + 1, 'MISSING_KHOA', 'Chưa xác định được khoa', {
        name: khoaName || khoaCode,
      });
      continue;
    }
    if (!name) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu tên bộ môn');
      continue;
    }
    try {
      let code;
      if (rawCode) {
        code = await resolveImportCode(rawCode, () => generateBoMonCode(name, khoa._id));
      } else {
        const existing = findEntityByNormalizedName(
          await BoMon.find({ khoaId: khoa._id }).select('code name').lean(),
          name,
        );
        code = existing?.code || (await generateBoMonCode(name, khoa._id));
      }
      await BoMon.findOneAndUpdate(
        { khoaId: khoa._id, code },
        { khoaId: khoa._id, code, name, description, isActive: true },
        { upsert: true, new: true },
      );
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }
  return results;
};

// ─── Lớp ───
export const getLops = (query, pagination) => {
  const filter = {};
  if (query.khoaId) filter.khoaId = query.khoaId;
  if (query.boMonId) filter.boMonId = query.boMonId;
  if (query.coVanId) filter.coVanId = query.coVanId;
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['name', 'code'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  return paginate(Lop, filter, pagination, [
    { path: 'khoaId', select: 'code name' },
    { path: 'boMonId', select: 'code name' },
    { path: 'coVanId', select: 'maGV fullName khoaId' },
  ]);
};

const resolveCoVanId = async (raw) => {
  if (raw === null || raw === undefined || raw === '') return null;
  const value = String(raw).trim();
  if (!value) return null;

  let gv = null;
  if (/^[a-f\d]{24}$/i.test(value)) {
    gv = await GiangVien.findById(value);
  }
  if (!gv) {
    gv = await GiangVien.findOne({ maGV: normalizeOrgCode(value), isActive: true });
  }
  if (!gv) {
    const all = await GiangVien.find({ isActive: true }).select('_id maGV fullName').lean();
    gv = findEntityByNormalizedName(
      all.map((row) => ({ ...row, name: row.fullName })),
      value,
    );
  }
  if (!gv) {
    throw new ValidationError('Cố vấn học tập không tồn tại');
  }
  return gv._id;
};

export const createLop = async (data) => {
  assertNonBlankText(data.name, 'Tên lớp');
  const name = data.name.trim();
  assertMaxLength(name, 'Tên lớp');
  assertValidOrgName(name, 'Tên lớp');

  const academicYear = data.academicYear != null ? String(data.academicYear).trim() : '';
  assertValidAcademicYear(academicYear);

  const boMon = await BoMon.findById(data.boMonId);
  if (!boMon) throw new ValidationError('Bộ môn không tồn tại');

  const code = await generateLopCode({ boMonId: boMon._id, academicYear });
  assertValidOrgCode(code, 'Mã lớp');

  const coVanId = await resolveCoVanId(data.coVanId ?? data.coVanMaGV ?? data.maGV);

  const lop = await Lop.create({
    ...data,
    code,
    name,
    academicYear,
    coVanId,
    khoaId: data.khoaId || boMon.khoaId,
  });

  if (coVanId) {
    await ensureCoVanHocTapAssignment(coVanId);
    const gv = await GiangVien.findById(coVanId);
    if (gv) await syncUserFromGiangVien(gv);
  }

  return lop;
};

export const updateLop = async (id, data) => {
  const payload = { ...data };
  delete payload.code;
  if (payload.name != null) {
    assertNonBlankText(payload.name, 'Tên lớp');
    payload.name = payload.name.trim();
    assertMaxLength(payload.name, 'Tên lớp');
    assertValidOrgName(payload.name, 'Tên lớp');
  }
  if (payload.academicYear != null) {
    payload.academicYear = String(payload.academicYear).trim();
    assertValidAcademicYear(payload.academicYear);
  }
  if (payload.coVanId !== undefined || payload.coVanMaGV !== undefined || payload.maGV !== undefined) {
    payload.coVanId = await resolveCoVanId(
      payload.coVanId !== undefined ? payload.coVanId : payload.coVanMaGV ?? payload.maGV,
    );
    delete payload.coVanMaGV;
    delete payload.maGV;
  }

  const prev = await Lop.findById(id).select('coVanId');
  const prevCoVanId = prev?.coVanId ? String(prev.coVanId) : null;

  const doc = await Lop.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    .populate('khoaId', 'code name')
    .populate('boMonId', 'code name')
    .populate('coVanId', 'maGV fullName khoaId');
  if (!doc) throw new NotFoundError('Không tìm thấy lớp');

  if (payload.coVanId !== undefined) {
    const nextCoVanId = payload.coVanId ? String(payload.coVanId) : null;
    if (nextCoVanId) {
      await ensureCoVanHocTapAssignment(nextCoVanId);
      const gv = await GiangVien.findById(nextCoVanId);
      if (gv) await syncUserFromGiangVien(gv);
    }
    if (prevCoVanId && prevCoVanId !== nextCoVanId) {
      await revokeCoVanHocTapIfNoClasses(prevCoVanId);
      const prevGv = await GiangVien.findById(prevCoVanId);
      if (prevGv) await syncUserFromGiangVien(prevGv);
    }
  }

  return doc;
};

export const deleteLop = async (id) => {
  const lop = await Lop.findById(id).select('coVanId');
  if (!lop) throw new NotFoundError('Không tìm thấy lớp');
  const coVanId = lop.coVanId ? String(lop.coVanId) : null;
  const doc = await softDelete(
    Lop,
    id,
    'Không thể ngừng hoạt động lớp đang có sinh viên đang hoạt động',
    (lopId) => SinhVien.countDocuments({ lopId, isActive: true }),
  );
  if (coVanId) {
    await revokeCoVanHocTapIfNoClasses(coVanId);
    const gv = await GiangVien.findById(coVanId);
    if (gv) await syncUserFromGiangVien(gv);
  }
  return doc;
};

export const importLops = async (buffer, defaults = {}) => {
  const { rows, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [] };

  let defaultBoMon = null;
  if (defaults.boMonId) {
    defaultBoMon = await BoMon.findOne({ _id: defaults.boMonId, isActive: true });
  }

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;
    const rawCode = cell(map, 'code', 'malop', 'ma lop', 'Mã lớp', 'MaLop', 'Ma lop');
    const name = cell(map, 'name', 'ten', 'tenlop', 'ten lop', 'Tên lớp', 'TenLop', 'Ten lop', 'Tên');

    let boMon = defaultBoMon;
    if (!boMon) {
      boMon = await resolveBoMonForImport(
        {
          khoaCode: cell(map, 'khoaCode', 'maKhoa', 'makhoa', 'ma khoa', 'Mã khoa').toUpperCase(),
          boMonCode: cell(map, 'boMonCode', 'maBoMon', 'mabomon', 'ma bo mon', 'Mã bộ môn').toUpperCase(),
          khoaName: cell(map, 'tenKhoa', 'ten khoa', 'Tên khoa', 'khoa', 'Khoa'),
          boMonName: cell(map, 'tenBoMon', 'ten bo mon', 'Tên bộ môn', 'boMon', 'BoMon', 'bomon', 'Bộ môn'),
        },
        defaults,
      );
    }

    if (!boMon) {
      pushImportError(results, headerRow + i + 1, 'MISSING_BOMON', 'Chưa xác định được bộ môn', {
        name: cell(map, 'tenBoMon', 'Tên bộ môn', 'boMon', 'Bộ môn', 'maBoMon', 'Mã bộ môn'),
      });
      continue;
    }
    if (!name) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu tên lớp');
      continue;
    }
    try {
      const trimmedName = name.trim();
      assertValidOrgName(trimmedName, 'Tên lớp');
      assertMaxLength(trimmedName, 'Tên lớp');
      const academicYear = cell(
        map,
        'academicYear',
        'namHoc',
        'nam hoc',
        'Năm học',
        'nienKhoa',
        'nien khoa',
        'Niên khóa',
        'Niên khoá',
      ).trim();
      assertValidAcademicYear(academicYear);
      let trimmedCode;
      if (rawCode) {
        trimmedCode = await resolveImportCode(rawCode, () =>
          generateLopCode({ boMonId: boMon._id, academicYear }),
        );
      } else {
        const existing = findEntityByNormalizedName(
          await Lop.find({ boMonId: boMon._id }).select('code name').lean(),
          trimmedName,
        );
        trimmedCode = existing?.code || (await generateLopCode({ boMonId: boMon._id, academicYear }));
      }
      assertValidOrgCode(trimmedCode, 'Mã lớp');
      assertMaxLength(trimmedCode, 'Mã lớp');
      const coVanRaw = cell(
        map,
        'coVanMaGV',
        'maGV',
        'magv',
        'ma gv',
        'Mã GV',
        'coVan',
        'cố vấn',
        'Cố vấn',
        'hoTenCoVan',
        'hotencovan',
        'ho ten co van',
        'Họ tên cố vấn',
        'Ten co van',
        'Tên cố vấn',
      ).trim();
      let coVanId = null;
      if (coVanRaw) {
        coVanId = await resolveCoVanId(coVanRaw);
      }
      const existingLop = await Lop.findOne({ boMonId: boMon._id, code: trimmedCode }).select('coVanId');
      const prevCoVanId = existingLop?.coVanId ? String(existingLop.coVanId) : null;

      await Lop.findOneAndUpdate(
        { boMonId: boMon._id, code: trimmedCode },
        {
          khoaId: boMon.khoaId,
          boMonId: boMon._id,
          code: trimmedCode,
          name: trimmedName,
          academicYear,
          ...(coVanRaw ? { coVanId } : {}),
          isActive: true,
        },
        { upsert: true, new: true },
      );
      if (coVanId) {
        await ensureCoVanHocTapAssignment(coVanId);
        const gv = await GiangVien.findById(coVanId);
        if (gv) await syncUserFromGiangVien(gv);
      }
      if (coVanRaw && prevCoVanId && prevCoVanId !== String(coVanId || '')) {
        await revokeCoVanHocTapIfNoClasses(prevCoVanId);
        const prevGv = await GiangVien.findById(prevCoVanId);
        if (prevGv) await syncUserFromGiangVien(prevGv);
      }
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }
  return results;
};

// ─── Sinh viên ───
export const getSinhViens = (query, pagination) => {
  const filter = {};
  if (query.khoaId) filter.khoaId = query.khoaId;
  if (query.boMonId) filter.boMonId = query.boMonId;
  if (query.lopId) filter.lopId = query.lopId;
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['fullName', 'maSV', 'email'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  return paginate(SinhVien, filter, pagination, [
    { path: 'khoaId', select: 'code name' },
    { path: 'boMonId', select: 'code name' },
    { path: 'lopId', select: 'code name' },
  ]);
};

export const createSinhVien = async (data) => {
  const lop = await Lop.findById(data.lopId);
  if (!lop) throw new ValidationError('Lớp không tồn tại');
  assertNonBlankText(data.fullName, 'Họ tên');
  const fullName = data.fullName.trim();
  assertMaxLength(fullName, 'Họ tên');
  assertValidOrgName(fullName, 'Họ tên');

  const maSV = await generateSinhVienMa(lop._id);
  assertMaxLengthOrgCode(maSV, 'Mã SV');
  assertValidOrgCode(maSV, 'Mã SV');

  const email = data.email != null ? String(data.email).trim().toLowerCase() : '';
  assertNonBlankText(data.email, 'Email');
  assertCtutEmail(email);
  await assertUniqueOrgEmail(email);
  const phone = assertValidPhoneIfProvided(data.phone);
  const sdtCha = assertValidPhoneIfProvided(data.sdtCha);
  const sdtMe = assertValidPhoneIfProvided(data.sdtMe);
  const identity = normalizeSinhVienIdentityFields(data);
  const maHoSo = await generateMaHoSo();
  const doc = await SinhVien.create({
    ...data,
    ...identity,
    maSV,
    maHoSo,
    fullName,
    email,
    phone,
    sdtCha,
    sdtMe,
    khoaId: data.khoaId || lop.khoaId,
    boMonId: data.boMonId || lop.boMonId,
  });
  await syncUserFromSinhVien(doc);
  return doc;
};

export const updateSinhVien = async (id, data) => {
  const current = await SinhVien.findById(id).select('userId');
  if (!current) throw new NotFoundError('Không tìm thấy sinh viên');

  const payload = { ...data };
  delete payload.maSV;
  delete payload.maHoSo;
  if (payload.fullName != null) {
    assertNonBlankText(payload.fullName, 'Họ tên');
    payload.fullName = payload.fullName.trim();
    assertMaxLength(payload.fullName, 'Họ tên');
    assertValidOrgName(payload.fullName, 'Họ tên');
  }
  if (payload.email != null) {
    assertNonBlankText(payload.email, 'Email');
    payload.email = String(payload.email).trim().toLowerCase();
    assertCtutEmail(payload.email);
    await assertUniqueOrgEmail(payload.email, {
      excludeSinhVienId: id,
      excludeUserId: current.userId,
    });
  }
  if (payload.phone != null) {
    payload.phone = assertValidPhoneIfProvided(payload.phone);
  }
  if (payload.sdtCha != null) {
    payload.sdtCha = assertValidPhoneIfProvided(payload.sdtCha);
  }
  if (payload.sdtMe != null) {
    payload.sdtMe = assertValidPhoneIfProvided(payload.sdtMe);
  }
  Object.assign(payload, normalizeSinhVienIdentityFields(payload));
  const doc = await SinhVien.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    .populate('khoaId', 'code name')
    .populate('boMonId', 'code name')
    .populate('lopId', 'code name');
  if (!doc) throw new NotFoundError('Không tìm thấy sinh viên');
  if (doc.isActive === false) {
    await deactivateUserLinkedToOrg({ userId: doc.userId, sinhVienId: doc._id });
  } else {
    await syncUserFromSinhVien(doc);
  }
  return doc;
};

export const deleteSinhVien = async (id) => {
  const doc = await softDelete(SinhVien, id);
  await deactivateUserLinkedToOrg({ userId: doc.userId, sinhVienId: doc._id });
  return doc;
};

const fitOrgName = (value, max = 100) =>
  String(value || '')
    .replace(/,/g, ' - ')
    .replace(/[^a-zA-Z0-9\u00C0-\u1EF9\s\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const toLopCode = (value) =>
  removeDiacritics(String(value || ''))
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 100);

const ensureImportLop = async (ctx, { lopCode, lopName, khoaName, academicYear }) => {
  const code = toLopCode(lopCode);
  if (!code) return null;
  const cached = ctx.lopByCode.get(code);
  if (cached) return cached;

  const khoaLabel = fitOrgName(khoaName, 100);
  if (!khoaLabel) return null;
  const khoaKey = normalizeText(khoaLabel);
  let khoa = ctx.khoaByName.get(khoaKey);
  if (!khoa) {
    const khoaCode = await generateKhoaCode(khoaLabel);
    const original = String(khoaName || '').trim();
    khoa = await Khoa.create({
      code: khoaCode,
      name: khoaLabel,
      description: original && original !== khoaLabel ? original.slice(0, 500) : '',
    });
    ctx.khoaByName.set(khoaKey, khoa);
    ctx.khoaById?.set(String(khoa._id), khoa);
  }

  const khoaId = String(khoa._id);
  let boMon = ctx.boMonByKhoa.get(khoaId);
  if (!boMon) {
    const bmCode = await generateBoMonCode('Chung', khoa._id);
    boMon = await BoMon.create({
      code: bmCode,
      name: 'Chung',
      khoaId: khoa._id,
      description: '',
    });
    ctx.boMonByKhoa.set(khoaId, boMon);
    ctx.boMonById?.set(String(boMon._id), boMon);
  }

  const name = fitOrgName(lopName, 100) || code;
  const year = /^\d{4}$/.test(String(academicYear || '')) ? String(academicYear) : '';
  const lop = await Lop.create({
    code,
    name,
    khoaId: khoa._id,
    boMonId: boMon._id,
    academicYear: year,
    isActive: true,
  });
  ctx.lopByCode.set(code, lop);
  return lop;
};

export const importSinhViens = async (buffer, defaults = {}) => {
  const { rows, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [] };

  const [khoaDocs, lopDocs, boMonDocs] = await Promise.all([
    Khoa.find({ isActive: true }),
    Lop.find({ isActive: true }),
    BoMon.find({ isActive: true }).sort({ createdAt: 1 }),
  ]);
  const ctx = {
    lopByCode: new Map(lopDocs.map((lop) => [String(lop.code).toUpperCase(), lop])),
    khoaByName: new Map(khoaDocs.map((khoa) => [normalizeText(khoa.name), khoa])),
    khoaById: new Map(khoaDocs.map((khoa) => [String(khoa._id), khoa])),
    boMonByKhoa: new Map(),
    boMonById: new Map(boMonDocs.map((boMon) => [String(boMon._id), boMon])),
  };
  for (const boMon of boMonDocs) {
    const key = String(boMon.khoaId);
    if (!ctx.boMonByKhoa.has(key)) ctx.boMonByKhoa.set(key, boMon);
  }
  const seenEmail = new Map();
  const [existingSvDocs, giangVienEmails, userDocs] = await Promise.all([
    SinhVien.find({}).select('maSV email maHoSo userId').lean(),
    GiangVien.find({ email: { $nin: ['', null] } }).select('email').lean(),
    User.find({}).select('email studentId sinhVienId role').lean(),
  ]);
  const svByMa = new Map(existingSvDocs.map((sv) => [String(sv.maSV).toUpperCase(), sv]));
  const svByEmail = new Map(existingSvDocs.map((sv) => [String(sv.email).toLowerCase(), sv]));
  const gvEmails = new Set(giangVienEmails.map((gv) => String(gv.email).toLowerCase()));
  const userByEmail = new Map(userDocs.map((user) => [String(user.email).toLowerCase(), user]));
  const yy = String(new Date().getFullYear()).slice(2);
  const hoSoPrefix = `HS${yy}`;
  let hoSoSeq = 0;
  for (const sv of existingSvDocs) {
    const match = String(sv.maHoSo || '').toUpperCase().match(new RegExp(`^${hoSoPrefix}(\\d{4})$`));
    if (match) hoSoSeq = Math.max(hoSoSeq, Number(match[1]));
  }
  const nextMaHoSo = () => {
    hoSoSeq += 1;
    return `${hoSoPrefix}${String(hoSoSeq).padStart(4, '0')}`;
  };
  const pending = [];

  let defaultLop = null;
  if (defaults.lopId) {
    defaultLop = await Lop.findOne({ _id: defaults.lopId, isActive: true });
  }

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;

    const fields = sinhVienRowFields(map);
    const {
      lopCode,
      maSV,
      fullName,
      email,
      phone,
      sdtCha,
      sdtMe,
      khoaToChuc,
      academicYearForLop,
      ...optionalFields
    } = fields;

    let lop = defaultLop;
    const resolvedLopToken = lopCode || String(optionalFields.lopHoc || '').trim();
    if (!lop && resolvedLopToken) {
      const codeKey = toLopCode(resolvedLopToken);
      lop = codeKey ? ctx.lopByCode.get(codeKey) : null;
      if (!lop) {
        const matched = findEntityByNormalizedName([...ctx.lopByCode.values()], resolvedLopToken);
        if (matched) lop = matched;
      }
    }
    if (!lop && khoaToChuc) {
      try {
        lop = await ensureImportLop(ctx, {
          lopCode: resolvedLopToken,
          lopName: optionalFields.lopHoc,
          khoaName: khoaToChuc,
          academicYear: academicYearForLop,
        });
      } catch (err) {
        pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message, {
          name: resolvedLopToken,
        });
        continue;
      }
    }

    if (!lop) {
      pushImportError(results, headerRow + i + 1, 'MISSING_LOP', 'Chưa xác định được lớp', {
        name: resolvedLopToken || cell(map, 'lop', 'Lop'),
      });
      continue;
    }
    const safeName = fitOrgName(fullName, 100);
    if (!safeName) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu họ tên');
      continue;
    }
    if (!email) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu email', {
        name: safeName,
        maSV: maSV || '',
      });
      continue;
    }
    try {
      let resolvedMaSV;
      if (maSV) {
        resolvedMaSV = await resolveImportCode(maSV, () => generateSinhVienMa(lop._id));
      } else {
        const existingByEmail = svByEmail.get(email.toLowerCase());
        resolvedMaSV = existingByEmail?.maSV || (await generateSinhVienMa(lop._id));
      }
      assertMaxLengthOrgCode(resolvedMaSV, 'Mã SV');
      assertValidOrgCode(resolvedMaSV, 'Mã SV');
      assertMaxLength(safeName, 'Họ tên');
      assertValidOrgName(safeName, 'Họ tên');
      assertCtutEmail(email);
      const emailKey = email.toLowerCase();
      const emailOwner = seenEmail.get(emailKey);
      if (emailOwner && emailOwner !== resolvedMaSV) {
        throw new ValidationError('Email bị trùng với sinh viên khác trong file');
      }
      const existingSv = svByMa.get(resolvedMaSV);
      const emailSv = svByEmail.get(emailKey);
      if (emailSv && String(emailSv.maSV).toUpperCase() !== resolvedMaSV) {
        throw new ValidationError('Email đã được sử dụng bởi hồ sơ sinh viên khác');
      }
      if (gvEmails.has(emailKey)) {
        throw new ValidationError('Email đã được sử dụng bởi tài khoản khác trong hệ thống');
      }
      const linkedUser = userByEmail.get(emailKey);
      if (linkedUser) {
        const sameSv = existingSv && linkedUser.sinhVienId && String(linkedUser.sinhVienId) === String(existingSv._id);
        const sameMa = linkedUser.studentId && String(linkedUser.studentId).toUpperCase() === resolvedMaSV;
        if (!sameSv && !sameMa) {
          throw new ValidationError('Email đã được sử dụng bởi tài khoản khác trong hệ thống');
        }
      }
      seenEmail.set(emailKey, resolvedMaSV);
      const normalizedPhone = normalizeImportPhone(phone);
      const normalizedSdtCha = normalizeImportPhone(sdtCha);
      const normalizedSdtMe = normalizeImportPhone(sdtMe);
      const identity = normalizeSinhVienIdentityFields(optionalFields);
      const maHoSo =
        optionalFields.maHoSo && String(optionalFields.maHoSo).trim()
          ? String(optionalFields.maHoSo).trim()
          : existingSv?.maHoSo || nextMaHoSo();

      const payload = {
        maSV: resolvedMaSV,
        maHoSo,
        fullName: safeName,
        email,
        phone: normalizedPhone,
        sdtCha: normalizedSdtCha,
        sdtMe: normalizedSdtMe,
        khoaId: lop.khoaId,
        boMonId: lop.boMonId,
        lopId: lop._id,
        isActive: true,
        ...identity,
      };

      for (const [key, value] of Object.entries(optionalFields)) {
        if (Object.prototype.hasOwnProperty.call(identity, key)) continue;
        if (value === '' || value === null || value === undefined) continue;
        payload[key] = value;
      }
      if (!payload.lopHoc) {
        payload.lopHoc = lop.name;
      }
      if (!payload.nganh || !payload.chuyenNganh || !payload.khoaHoc) {
        const khoaDoc = ctx.khoaById.get(String(lop.khoaId));
        const boMonDoc = ctx.boMonById.get(String(lop.boMonId));
        if (!payload.nganh) payload.nganh = khoaDoc?.name || '';
        if (!payload.chuyenNganh) payload.chuyenNganh = boMonDoc?.name || '';
        if (!payload.khoaHoc) {
          const year = String(lop.academicYear || '').trim();
          if (/^\d{4}$/.test(year)) payload.khoaHoc = `K${year.slice(2)}`;
        }
      }
      if (!payload.gender) payload.gender = 'male';
      if (!payload.status) payload.status = 'Đang học';
      if (!payload.loaiHinhDaoTao || /đại học/i.test(String(payload.loaiHinhDaoTao))) {
        payload.loaiHinhDaoTao = 'Chính quy';
      }
      if (/^\d{4}$/.test(String(payload.khoaHoc || ''))) {
        payload.khoaHoc = `K${String(payload.khoaHoc).slice(2)}`;
      }
      if (!payload.quocTich) payload.quocTich = 'Việt Nam';
      payload.noiCapCCCD = optionalFields.noiCapCCCD || '';
      // Chuẩn hóa cơ sở: "Cơ sở 1" → "1"
      if (payload.coSo) {
        const coSoMatch = String(payload.coSo).match(/([123])/);
        if (coSoMatch) payload.coSo = coSoMatch[1];
      }

      svByMa.set(resolvedMaSV, { ...(existingSv || {}), maSV: resolvedMaSV, email: emailKey, maHoSo });
      svByEmail.set(emailKey, svByMa.get(resolvedMaSV));
      pending.push(payload);
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }

  const chunk = 500;
  for (let i = 0; i < pending.length; i += chunk) {
    const slice = pending.slice(i, i + chunk);
    await SinhVien.bulkWrite(
      slice.map((doc) => ({
        updateOne: {
          filter: { maSV: doc.maSV },
          update: { $set: doc },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    console.log(`[import-sv] đã lưu ${Math.min(i + chunk, pending.length)}/${pending.length}`);
  }

  if (pending.length) {
    const saved = await SinhVien.find({ maSV: { $in: pending.map((doc) => doc.maSV) } });
    await bulkSyncStudentUsers(saved);
  }
  return results;
};

// ─── Giảng viên ───
/** Gắn danh sách lớp mà GV đang làm cố vấn (từ Lop.coVanId). */
const attachLopCoVans = async (giangViens) => {
  const list = Array.isArray(giangViens) ? giangViens : [giangViens];
  if (!list.length) return giangViens;

  const ids = list.map((d) => d._id);
  const lops = await Lop.find({ coVanId: { $in: ids }, isActive: true })
    .select('code name coVanId')
    .sort({ code: 1 })
    .lean();

  const byGv = new Map();
  for (const lop of lops) {
    const key = String(lop.coVanId);
    if (!byGv.has(key)) byGv.set(key, []);
    byGv.get(key).push({ _id: lop._id, code: lop.code, name: lop.name });
  }

  const attached = list.map((d) => {
    const obj = typeof d.toObject === 'function' ? d.toObject() : { ...d };
    obj.lopCoVans = byGv.get(String(d._id)) || [];
    return obj;
  });
  return Array.isArray(giangViens) ? attached : attached[0];
};

const normalizeLopCoVanIds = (data) => {
  if (!data || typeof data !== 'object') return undefined;
  if (Object.prototype.hasOwnProperty.call(data, 'lopCoVanIds')) {
    const raw = data.lopCoVanIds;
    if (raw == null || raw === '') return [];
    return (Array.isArray(raw) ? raw : [raw]).map(String).filter(Boolean);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'lopCoVanId')) {
    const raw = data.lopCoVanId;
    if (raw == null || raw === '') return [];
    return [String(raw)];
  }
  return undefined;
};

/** Đồng bộ cố vấn lớp: gán các lớp selected; gỡ GV khỏi lớp không còn chọn. */
const syncLopCoVansForGiangVien = async (giangVienId, lopIds) => {
  if (lopIds === undefined) return;

  const desired = [...new Set(lopIds.map(String).filter(Boolean))];
  if (desired.length) {
    const found = await Lop.find({ _id: { $in: desired }, isActive: true }).select('_id');
    if (found.length !== desired.length) {
      throw new ValidationError('Một hoặc nhiều lớp cố vấn không tồn tại');
    }
  }

  await Lop.updateMany(
    { coVanId: giangVienId, ...(desired.length ? { _id: { $nin: desired } } : {}) },
    { $set: { coVanId: null } },
  );

  if (desired.length) {
    await Lop.updateMany(
      { _id: { $in: desired } },
      { $set: { coVanId: giangVienId } },
    );
  }
};

/**
 * Khi GV được gán ít nhất 1 lớp cố vấn → đảm bảo có quyền co_van_hoc_tap
 * (nhiệm vụ cố vấn — không đổi User.role thành academic_advisor).
 */
const ensureCoVanHocTapAssignment = async (giangVienId) => {
  const quyen = await Quyen.findOne({ code: 'co_van_hoc_tap', isActive: true });
  if (!quyen) return;

  const gv = await GiangVien.findById(giangVienId).select('khoaId boMonId');
  if (!gv) return;

  const khoaId = gv.khoaId || null;
  const boMonId = gv.boMonId || null;
  const existing = await GiangVienQuyen.findOne({ giangVienId, quyenId: quyen._id });

  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      existing.khoaId = khoaId;
      existing.boMonId = boMonId;
      await existing.save();
    }
    return;
  }

  await GiangVienQuyen.create({
    giangVienId,
    quyenId: quyen._id,
    khoaId,
    boMonId,
    isActive: true,
  });
};

/** Thu hồi quyền CVHT nếu GV không còn cố vấn lớp nào đang active */
const revokeCoVanHocTapIfNoClasses = async (giangVienId) => {
  if (!giangVienId) return;
  const stillHas = await Lop.exists({ coVanId: giangVienId, isActive: true });
  if (stillHas) return;

  const quyen = await Quyen.findOne({ code: 'co_van_hoc_tap' });
  if (!quyen) return;
  await GiangVienQuyen.updateMany(
    { giangVienId, quyenId: quyen._id, isActive: true },
    { $set: { isActive: false } },
  );
};

const pickBestLopCandidate = (candidates, context = {}) => {
  if (!candidates?.length) return null;
  if (candidates.length === 1) return candidates[0];

  if (context.boMonId) {
    const inBoMon = candidates.filter((l) => String(l.boMonId) === String(context.boMonId));
    if (inBoMon.length === 1) return inBoMon[0];
    if (inBoMon.length > 1) return inBoMon[0];
  }
  if (context.khoaId) {
    const inKhoa = candidates.filter((l) => String(l.khoaId) === String(context.khoaId));
    if (inKhoa.length) return inKhoa[0];
  }
  return candidates[0];
};

/**
 * Resolve cột Lớp cố vấn: chấp nhận mã lớp (HTTT20) hoặc tên lớp (Hệ thống thông tin20).
 * Nếu trùng mã/tên giữa nhiều bộ môn → ưu tiên theo khoa/bộ môn của GV.
 */
const resolveLopCodesForAdvisor = async (lopCodesText, context = {}) => {
  if (lopCodesText == null) return undefined;
  const tokens = String(lopCodesText)
    .split(/[,;|/]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (!tokens.length) return [];

  const allActive = await Lop.find({ isActive: true })
    .select('_id code name khoaId boMonId')
    .lean();

  const byCode = new Map();
  for (const lop of allActive) {
    const key = normalizeOrgCode(lop.code);
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(lop);
  }

  const resolvedIds = [];
  const missing = [];

  for (const token of tokens) {
    const codeKey = normalizeOrgCode(token);
    let candidates = byCode.get(codeKey) || [];

    if (!candidates.length) {
      const matched = findEntityByNormalizedName(allActive, token);
      if (matched) {
        const nameKey = normalizeText(matched.name);
        candidates = allActive.filter((l) => normalizeText(l.name) === nameKey);
        if (!candidates.length) candidates = [matched];
      }
    }

    const picked = pickBestLopCandidate(candidates, context);
    if (!picked) {
      missing.push(token);
    } else {
      resolvedIds.push(String(picked._id));
    }
  }

  if (missing.length) {
    throw new ValidationError(
      `Không tìm thấy lớp: ${missing.join(', ')}. ` +
        'Hãy điền mã lớp đã có trong hệ thống (ví dụ HTTT20), hoặc đúng tên lớp; nhiều lớp cách nhau bằng dấu phẩy.',
    );
  }

  return [...new Set(resolvedIds)];
};

/** Sau khi gán/bỏ lớp cố vấn: đồng bộ quyền CVHT rồi sync User. */
const afterAdvisorLopsChanged = async (giangVienDoc, lopCoVanIds) => {
  if (lopCoVanIds === undefined) {
    await syncUserFromGiangVien(giangVienDoc);
    return;
  }
  if (lopCoVanIds.length > 0) {
    await ensureCoVanHocTapAssignment(giangVienDoc._id);
  } else {
    await revokeCoVanHocTapIfNoClasses(giangVienDoc._id);
  }
  await syncUserFromGiangVien(giangVienDoc);
};

export const getGiangViens = async (query, pagination) => {
  const filter = {};
  if (query.khoaId) filter.khoaId = query.khoaId;
  if (query.boMonId) filter.boMonId = query.boMonId;
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['fullName', 'maGV', 'email'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  const result = await paginate(GiangVien, filter, pagination, [
    { path: 'khoaId', select: 'code name' },
    { path: 'boMonId', select: 'code name' },
  ]);
  result.data = await attachLopCoVans(result.data);
  return result;
};

export const createGiangVien = async (data) => {
  const lopCoVanIds = normalizeLopCoVanIds(data);
  const boMon = await BoMon.findById(data.boMonId);
  if (!boMon) throw new ValidationError('Bộ môn không tồn tại');
  assertNonBlankText(data.fullName, 'Họ tên');
  const fullName = data.fullName.trim();
  assertMaxLength(fullName, 'Họ tên');
  assertValidOrgName(fullName, 'Họ tên');

  const khoaId = data.khoaId || boMon.khoaId;
  const maGV = await generateGiangVienMa(khoaId);
  assertMaxLengthOrgCode(maGV, 'Mã GV');
  assertValidOrgCode(maGV, 'Mã GV');

  const email = data.email != null ? String(data.email).trim().toLowerCase() : '';
  assertNonBlankText(data.email, 'Email');
  assertStandardEmail(email);
  await assertUniqueOrgEmail(email);
  const phone = assertValidPhoneIfProvided(data.phone);
  const {
    lopCoVanIds: _ignoreIds,
    lopCoVanId: _ignoreId,
    ...rest
  } = data;
  const doc = await GiangVien.create({
    ...rest,
    maGV,
    fullName,
    email,
    phone,
    khoaId,
  });
  await syncLopCoVansForGiangVien(doc._id, lopCoVanIds);
  await afterAdvisorLopsChanged(doc, lopCoVanIds);
  return attachLopCoVans(doc);
};

export const updateGiangVien = async (id, data) => {
  const current = await GiangVien.findById(id).select('userId');
  if (!current) throw new NotFoundError('Không tìm thấy giảng viên');

  const lopCoVanIds = normalizeLopCoVanIds(data);
  const {
    lopCoVanIds: _ignoreIds,
    lopCoVanId: _ignoreId,
    ...rest
  } = data;
  const payload = { ...rest };
  delete payload.maGV;
  if (payload.fullName != null) {
    assertNonBlankText(payload.fullName, 'Họ tên');
    payload.fullName = payload.fullName.trim();
    assertMaxLength(payload.fullName, 'Họ tên');
    assertValidOrgName(payload.fullName, 'Họ tên');
  }
  if (payload.email != null) {
    assertNonBlankText(payload.email, 'Email');
    payload.email = String(payload.email).trim().toLowerCase();
    assertStandardEmail(payload.email);
    await assertUniqueOrgEmail(payload.email, {
      excludeGiangVienId: id,
      excludeUserId: current.userId,
    });
  }
  if (payload.phone != null) {
    payload.phone = assertValidPhoneIfProvided(payload.phone);
  }
  const doc = await GiangVien.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    .populate('khoaId', 'code name')
    .populate('boMonId', 'code name');
  if (!doc) throw new NotFoundError('Không tìm thấy giảng viên');
  if (payload.isActive === true && doc.userId) {
    await User.findByIdAndUpdate(doc.userId, { isActive: true });
  }
  await syncLopCoVansForGiangVien(id, lopCoVanIds);
  await afterAdvisorLopsChanged(doc, lopCoVanIds);
  return attachLopCoVans(doc);
};

export const deleteGiangVien = async (id) => {
  const doc = await softDelete(GiangVien, id);
  await Lop.updateMany({ coVanId: id }, { $set: { coVanId: null } });
  await GiangVienQuyen.updateMany({ giangVienId: id, isActive: true }, { $set: { isActive: false } });
  await deactivateUserLinkedToOrg({ userId: doc.userId, giangVienId: doc._id });
  return doc;
};

const resolveBoMonForImport = async (fields, defaults = {}) => {
  if (defaults.boMonId) {
    const fromDefault = await BoMon.findOne({ _id: defaults.boMonId, isActive: true });
    if (fromDefault) return fromDefault;
  }

  let khoa = null;
  if (fields.khoaCode) {
    khoa = await Khoa.findOne({ code: fields.khoaCode, isActive: true });
  } else if (defaults.khoaId) {
    khoa = await Khoa.findOne({ _id: defaults.khoaId, isActive: true });
  } else if (fields.khoaName) {
    const khoas = await Khoa.find({ isActive: true });
    khoa = findEntityByNormalizedName(khoas, fields.khoaName);
    if (!khoa) {
      khoa = await Khoa.findOne({
        name: { $regex: new RegExp(escapeRegex(fields.khoaName), 'i') },
        isActive: true,
      });
    }
  }

  if (fields.boMonCode) {
    if (khoa) {
      const scoped = await BoMon.findOne({ khoaId: khoa._id, code: fields.boMonCode, isActive: true });
      if (scoped) return scoped;
    }
    const global = await BoMon.findOne({ code: fields.boMonCode, isActive: true });
    if (global) return global;
  }

  if (fields.boMonName) {
    const filter = { isActive: true };
    if (khoa) filter.khoaId = khoa._id;
    const boMons = await BoMon.find(filter);
    const matched = findEntityByNormalizedName(boMons, fields.boMonName);
    if (matched) return matched;

    if (khoa) {
      const allBoMons = await BoMon.find({ isActive: true });
      return findEntityByNormalizedName(allBoMons, fields.boMonName);
    }
  }

  return null;
};

export const importGiangViens = async (buffer, defaults = {}) => {
  const { rows, detectedHeaders, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [], detectedHeaders, headerRow };

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;
    const fields = giangVienRowFields(map);

    if (!fields.fullName) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu họ tên');
      continue;
    }

    const email = fields.email?.trim().toLowerCase() ?? '';
    if (!email) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu email');
      continue;
    }

    const boMon = await resolveBoMonForImport(fields, defaults);
    if (!boMon) {
      pushImportError(results, headerRow + i + 1, 'MISSING_BOMON', 'Chưa có bộ môn trong hệ thống', {
        name: fields.boMonName || fields.boMonCode,
      });
      continue;
    }

    try {
      let maGV;
      if (fields.maGV) {
        maGV = await resolveImportCode(fields.maGV, () => generateGiangVienMa(boMon.khoaId));
      } else {
        const existingByEmail = await GiangVien.findOne({ email }).select('maGV');
        maGV = existingByEmail?.maGV || (await generateGiangVienMa(boMon.khoaId));
      }
      assertMaxLengthOrgCode(maGV, 'Mã GV');
      assertValidOrgCode(maGV, 'Mã GV');
      const fullName = fields.fullName.trim();
      assertMaxLength(fullName, 'Họ tên');
      assertValidOrgName(fullName, 'Họ tên');
      assertStandardEmail(email);
      const existingGv = await GiangVien.findOne({ maGV });
      await assertUniqueOrgEmail(email, { excludeGiangVienId: existingGv?._id });
      const phone = assertValidPhoneIfProvided(fields.phone);
      const hasLopCoVanColumn = mapHasAnyKey(
        map,
        'lopCoVan',
        'lopCoVanCodes',
        'lop co van',
        'lopcovan',
        'Lớp cố vấn',
        'Lop co van',
        'maLop',
        'ma lop',
        'Mã lớp',
        'Ma lop',
        'lop',
      );
      const lopCoVanIds = hasLopCoVanColumn
        ? await resolveLopCodesForAdvisor(fields.lopCoVanCodes, {
            khoaId: boMon.khoaId,
            boMonId: boMon._id,
          })
        : undefined;
      const gv = await GiangVien.findOneAndUpdate(
        { maGV },
        {
          maGV,
          fullName,
          email,
          phone,
          khoaId: boMon.khoaId,
          boMonId: boMon._id,
          isActive: true,
        },
        { upsert: true, new: true },
      );
      await syncLopCoVansForGiangVien(gv._id, lopCoVanIds);
      await afterAdvisorLopsChanged(gv, lopCoVanIds);
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }

  if (results.success === 0 && results.errors.length > 1) {
    const firstMsg = results.errors[0].message;
    if (results.errors.every((e) => e.message === firstMsg)) {
      results.errors = [{ row: results.errors[0].row, message: `${firstMsg} (${results.errors.length} dòng)` }];
    }
  }

  return results;
};

// ─── Quyền ───
/** Đồng bộ User theo quyền + lớp cố vấn (tạo User nếu chưa có). */
export const syncUserRoleFromGiangVienQuyens = async (giangVienDoc) => {
  if (!giangVienDoc) return null;
  return syncUserFromGiangVien(giangVienDoc);
};

export const getQuyens = (query, pagination) => {
  const filter = {};
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  if (query.search) {
    const searchFilter = buildAccentInsensitiveOrFilter(['name', 'code'], query.search);
    if (searchFilter) filter.$or = searchFilter.$or;
  }
  return paginate(Quyen, filter, pagination);
};

export const getAllQuyens = async () => {
  const rows = await Quyen.find({ isActive: true }).lean();
  const order = new Map(QUYEN_CATALOG.map((q, i) => [q.code, i]));
  return rows.sort((a, b) => {
    const ai = order.has(a.code) ? order.get(a.code) : 999;
    const bi = order.has(b.code) ? order.get(b.code) : 999;
    if (ai !== bi) return ai - bi;
    return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
  });
};

export const createQuyen = async (data) => {
  const name = String(data.name || '').trim();
  if (!name) throw new ValidationError('Thiếu tên quyền');
  const code = await generateQuyenCode(name);
  const payload = {
    code,
    name,
    group: data.group ? String(data.group).trim() : '',
    description: data.description ? String(data.description).trim() : '',
    isActive: true,
  };
  // Soft-delete rồi thêm lại cùng mã → kích hoạt lại bản ghi cũ (unique code)
  return Quyen.findOneAndUpdate({ code }, payload, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
    runValidators: true,
  });
};

const resolveQuyenGroupKey = (raw) => {
  const text = String(raw || '').trim();
  if (!text) return '';
  const byKey = QUYEN_GROUPS.find((g) => g.key === text);
  if (byKey) return byKey.key;
  const matched = findEntityByNormalizedName(
    QUYEN_GROUPS.map((g) => ({ name: g.label, key: g.key })),
    text,
  );
  return matched?.key || '';
};

export const importQuyens = async (buffer) => {
  const { rows, headerRow } = parseRows(buffer);
  const results = { success: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const map = toRowMap(rows[i]);
    if (isEmptyRow(map)) continue;

    const name = cell(
      map,
      'name',
      'ten',
      'tenQuyen',
      'ten quyen',
      'Tên quyền',
      'Ten quyen',
      'Tên hiển thị',
      'Ten hien thi',
    );
    const groupRaw = cell(
      map,
      'group',
      'nhom',
      'nhomQuyen',
      'nhom quyen',
      'Nhóm',
      'Nhom',
      'Nhóm quyền',
    );
    const description = cell(map, 'description', 'moTa', 'mota', 'mo ta', 'Mô tả', 'Mo ta');
    const rawCode = cell(map, 'code', 'maQuyen', 'ma quyen', 'Mã quyền', 'Ma quyen');

    if (!name) {
      pushImportError(results, headerRow + i + 1, 'MISSING_FIELDS', 'Thiếu tên quyền');
      continue;
    }
    const group = resolveQuyenGroupKey(groupRaw);
    if (!group) {
      pushImportError(
        results,
        headerRow + i + 1,
        'MISSING_GROUP',
        `Thiếu hoặc sai nhóm quyền. Cho phép: ${QUYEN_GROUPS.map((g) => g.label).join(', ')}`,
        { name: groupRaw },
      );
      continue;
    }

    try {
      const trimmedName = name.trim();
      let code;
      if (rawCode) {
        code = await resolveImportCode(rawCode, () => generateQuyenCode(trimmedName));
      } else {
        const existing = findEntityByNormalizedName(
          await Quyen.find({}).select('code name').lean(),
          trimmedName,
        );
        code = existing?.code || (await generateQuyenCode(trimmedName));
      }
      await Quyen.findOneAndUpdate(
        { code },
        {
          code,
          name: trimmedName,
          group,
          description: description ? String(description).trim() : '',
          isActive: true,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
      );
      results.success++;
    } catch (err) {
      pushImportError(results, headerRow + i + 1, 'VALIDATION', err.message);
    }
  }

  return results;
};

export const updateQuyen = async (id, data) => {
  const payload = { ...data };
  delete payload.code;
  if (payload.name != null) payload.name = String(payload.name).trim();
  if (payload.description != null) payload.description = String(payload.description).trim();
  const doc = await Quyen.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  if (!doc) throw new NotFoundError('Không tìm thấy quyền');
  return doc;
};

export const deleteQuyen = async (id) => {
  const quyen = await Quyen.findById(id);
  if (!quyen) throw new NotFoundError('Không tìm thấy quyền');
  quyen.isActive = false;
  await quyen.save();

  const assignments = await GiangVienQuyen.find({ quyenId: id, isActive: true }).select('giangVienId');
  if (assignments.length) {
    await GiangVienQuyen.updateMany({ quyenId: id, isActive: true }, { $set: { isActive: false } });
    const gvIds = [...new Set(assignments.map((a) => String(a.giangVienId)))];
    for (const gvId of gvIds) {
      const gv = await GiangVien.findById(gvId);
      if (gv) await syncUserFromGiangVien(gv);
    }
  }
  return quyen;
};

// ─── Gán quyền GV ───
const GV_ASSIGNABLE_EXCLUDE = new Set(['sinh_vien', 'quan_tri_vien']);

export const getGiangVienQuyens = (query, pagination) => {
  const filter = {};
  if (query.giangVienId) filter.giangVienId = query.giangVienId;
  if (query.isActive !== 'all') filter.isActive = query.isActive !== 'false';
  return paginate(GiangVienQuyen, filter, pagination, [
    { path: 'giangVienId', select: 'maGV fullName email khoaId boMonId userId' },
    { path: 'quyenId', select: 'code name' },
    { path: 'khoaId', select: 'code name' },
    { path: 'boMonId', select: 'code name' },
  ]);
};

export const assignGiangVienQuyen = async (data) => {
  const gv = await GiangVien.findById(data.giangVienId);
  const quyen = await Quyen.findById(data.quyenId);
  if (!gv) throw new ValidationError('Giảng viên không tồn tại');
  if (!quyen || quyen.isActive === false) throw new ValidationError('Quyền không tồn tại');
  if (GV_ASSIGNABLE_EXCLUDE.has(quyen.code)) {
    throw new ValidationError('Không thể gán quyền hệ thống Sinh viên / Quản trị viên cho giảng viên');
  }

  const khoaId = data.khoaId || gv.khoaId || null;
  const boMonId = data.boMonId || gv.boMonId || null;

  const existing = await GiangVienQuyen.findOne({
    giangVienId: gv._id,
    quyenId: quyen._id,
    khoaId,
    boMonId,
  });

  let doc;
  if (existing) {
    if (existing.isActive) {
      throw new ValidationError('Giảng viên đã được gán quyền này với cùng phạm vi khoa/bộ môn');
    }
    existing.isActive = true;
    await existing.save();
    doc = existing;
  } else {
    doc = await GiangVienQuyen.create({
      giangVienId: gv._id,
      quyenId: quyen._id,
      khoaId,
      boMonId,
      isActive: true,
    });
  }

  await syncUserRoleFromGiangVienQuyens(gv);
  return GiangVienQuyen.findById(doc._id)
    .populate('giangVienId', 'maGV fullName email khoaId boMonId userId')
    .populate('quyenId', 'code name')
    .populate('khoaId', 'code name')
    .populate('boMonId', 'code name');
};

export const revokeGiangVienQuyen = async (id) => {
  const doc = await GiangVienQuyen.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!doc) throw new NotFoundError('Không tìm thấy bản ghi phân quyền');
  const gv = await GiangVien.findById(doc.giangVienId);
  await syncUserRoleFromGiangVienQuyens(gv);
  return doc;
};
