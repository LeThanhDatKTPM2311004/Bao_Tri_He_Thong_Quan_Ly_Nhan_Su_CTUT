/**
 * Tự sinh mã tổ chức theo quy tắc cố định (người dùng không nhập/sửa).
 *
 * - Khoa / Bộ môn / Quyền: viết tắt Latin không dấu từ tên (CNTT, HTTT, TK…)
 * - Lớp: {mãBM}{2 số cuối niên khóa} (HTTT22)
 * - GV: GV + {mã khoa} + số tăng dần 2 chữ số (GVCNTT01)
 * - SV: {mã lớp} + số tăng dần 4 chữ số (HTTT220001)
 * - Mã hồ sơ: HS + {yy} + số tăng dần 4 chữ số (HS240801)
 */
import Khoa from './models/khoa.model.js';
import BoMon from './models/boMon.model.js';
import Lop from './models/lop.model.js';
import GiangVien from './models/giangVien.model.js';
import SinhVien from './models/sinhVien.model.js';
import Quyen from './models/quyen.model.js';
import { ORG_CODE_MAX_LENGTH, normalizeOrgCode } from '../../shared/validators/organizationText.js';
import { ValidationError } from '../../shared/errors/AppError.js';

const VI_MAP =
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VI_TO =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

const STOP_WORDS = new Set(['va', 'cua', 'cac', 'and', 'of', 'the', 'amp']);

export const removeDiacritics = (text) => {
  let out = String(text || '');
  for (let i = 0; i < VI_MAP.length; i += 1) {
    out = out.replace(new RegExp(VI_MAP[i], 'gi'), VI_TO[i]);
  }
  return out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

/** Viết tắt từ tên: bỏ tiền tố Khoa/Bộ môn (trừ "Khoa học…"), lấy chữ cái đầu mỗi từ. */
export const abbreviateFromName = (name, { minLen = 2, maxLen = 8 } = {}) => {
  let normalized = removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // "Khoa học máy tính" → KHMT; "Khoa Công nghệ…" → CNTT
  if (!/^khoa\s+hoc\b/.test(normalized)) {
    normalized = normalized.replace(/^(khoa|bo mon|bomon)\s+/i, '').trim();
  }

  const words = normalized.split(' ').filter((w) => w && !STOP_WORDS.has(w));
  let abbr = words.map((w) => w[0]).join('').toUpperCase();
  if (abbr.length < minLen && words[0]) {
    abbr = words[0].replace(/[^a-z0-9]/gi, '').slice(0, maxLen).toUpperCase();
  }
  if (!abbr) abbr = 'X';
  return abbr.slice(0, maxLen);
};

const clipCode = (code) => String(code || '').toUpperCase().slice(0, ORG_CODE_MAX_LENGTH);

/**
 * Đảm bảo mã unique: nếu trùng thì thêm số đuôi (CNTT → CNTT2 → CNTT3).
 */
export const ensureUniqueCode = async (Model, baseCode, { field = 'code', filter = {}, excludeId } = {}) => {
  const base = clipCode(normalizeOrgCode(baseCode) || 'X');
  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};

  const exists = async (code) => Model.exists({ ...filter, ...notSelf, [field]: code });

  if (!(await exists(base))) return base;

  for (let i = 2; i <= 9999; i += 1) {
    const suffix = String(i);
    const candidate = clipCode(`${base.slice(0, ORG_CODE_MAX_LENGTH - suffix.length)}${suffix}`);
    if (!(await exists(candidate))) return candidate;
  }
  throw new ValidationError('Không thể sinh mã duy nhất — vui lòng thử lại');
};

const yearSuffix2 = (academicYear) => {
  const raw = String(academicYear || '').trim();
  if (/^\d{4}$/.test(raw)) return raw.slice(2);
  if (/^\d{2}$/.test(raw)) return raw;
  return String(new Date().getFullYear()).slice(2);
};

const nextSeqForPrefix = async (Model, field, prefix, digits) => {
  const safePrefix = clipCode(prefix);
  const re = new RegExp(`^${safePrefix}(\\d{${digits}})$`, 'i');
  const rows = await Model.find({ [field]: { $regex: `^${safePrefix}\\d{${digits}}$`, $options: 'i' } })
    .select(field)
    .lean();
  let max = 0;
  for (const row of rows) {
    const m = String(row[field] || '').toUpperCase().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  const maxNum = 10 ** digits - 1;
  if (next > maxNum) {
    throw new ValidationError(`Đã hết dải số cho tiền tố ${safePrefix}`);
  }
  return `${safePrefix}${String(next).padStart(digits, '0')}`;
};

export const generateKhoaCode = async (name) => {
  const base = abbreviateFromName(name, { maxLen: 8 });
  return ensureUniqueCode(Khoa, base);
};

export const generateQuyenCode = async (name) => {
  const base = abbreviateFromName(name, { maxLen: 8 });
  return ensureUniqueCode(Quyen, base);
};

export const generateBoMonCode = async (name, khoaId) => {
  const base = abbreviateFromName(name, { maxLen: 8 });
  return ensureUniqueCode(BoMon, base, { filter: khoaId ? { khoaId } : {} });
};

export const generateLopCode = async ({ boMonId, academicYear }) => {
  const boMon = await BoMon.findById(boMonId).select('code');
  if (!boMon?.code) throw new ValidationError('Bộ môn không hợp lệ để sinh mã lớp');
  const base = clipCode(`${boMon.code}${yearSuffix2(academicYear)}`);
  return ensureUniqueCode(Lop, base, { filter: { boMonId } });
};

export const generateGiangVienMa = async (khoaId) => {
  const khoa = await Khoa.findById(khoaId).select('code');
  if (!khoa?.code) throw new ValidationError('Khoa không hợp lệ để sinh mã GV');
  const digits = 2;
  const trimmedPrefix = clipCode(`GV${khoa.code}`.slice(0, ORG_CODE_MAX_LENGTH - digits));
  return nextSeqForPrefix(GiangVien, 'maGV', trimmedPrefix, digits);
};

export const generateSinhVienMa = async (lopId) => {
  const lop = await Lop.findById(lopId).select('code');
  if (!lop?.code) throw new ValidationError('Lớp không hợp lệ để sinh mã SV');
  const digits = 4;
  const prefix = clipCode(lop.code).slice(0, ORG_CODE_MAX_LENGTH - digits);
  return nextSeqForPrefix(SinhVien, 'maSV', prefix, digits);
};

export const generateMaHoSo = async () => {
  const yy = String(new Date().getFullYear()).slice(2);
  const prefix = `HS${yy}`;
  return nextSeqForPrefix(SinhVien, 'maHoSo', prefix, 4);
};

/** Import: dùng mã file nếu có; không có thì tự sinh. */
export const resolveImportCode = async (provided, generateFn) => {
  const raw = provided != null ? String(provided).trim() : '';
  if (raw) return normalizeOrgCode(raw);
  return generateFn();
};
