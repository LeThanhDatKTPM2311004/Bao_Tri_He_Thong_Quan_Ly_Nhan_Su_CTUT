/**
 * Xem trước mã tổ chức (khớp quy tắc server orgCodeGenerate.js).
 * Chỉ dùng để hiển thị trên form — mã thật vẫn do server sinh khi lưu.
 */

const ORG_CODE_MAX_LENGTH = 15;

const VI_MAP =
  'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VI_TO =
  'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd';

const STOP_WORDS = new Set(['va', 'cua', 'cac', 'and', 'of', 'the', 'amp']);

export const removeDiacritics = (text: string) => {
  let out = String(text || '');
  for (let i = 0; i < VI_MAP.length; i += 1) {
    out = out.replace(new RegExp(VI_MAP[i], 'gi'), VI_TO[i]);
  }
  return out.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export const abbreviateFromName = (name: string, maxLen = 8) => {
  let normalized = removeDiacritics(name)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/^khoa\s+hoc\b/.test(normalized)) {
    normalized = normalized.replace(/^(khoa|bo mon|bomon)\s+/i, '').trim();
  }

  const words = normalized.split(' ').filter((w) => w && !STOP_WORDS.has(w));
  let abbr = words.map((w) => w[0]).join('').toUpperCase();
  if (abbr.length < 2 && words[0]) {
    abbr = words[0].replace(/[^a-z0-9]/gi, '').slice(0, maxLen).toUpperCase();
  }
  if (!abbr) return '';
  return abbr.slice(0, maxLen);
};

const clip = (code: string) => code.toUpperCase().slice(0, ORG_CODE_MAX_LENGTH);

const ensureUnique = (base: string, existing: string[]) => {
  const set = new Set(existing.map((c) => String(c || '').toUpperCase()));
  const root = clip(base);
  if (!root) return '';
  if (!set.has(root)) return root;
  for (let i = 2; i <= 9999; i += 1) {
    const suffix = String(i);
    const candidate = clip(`${root.slice(0, ORG_CODE_MAX_LENGTH - suffix.length)}${suffix}`);
    if (!set.has(candidate)) return candidate;
  }
  return root;
};

const nextSeq = (prefix: string, existing: string[], digits: number) => {
  const safe = clip(prefix);
  if (!safe) return '';
  const re = new RegExp(`^${safe}(\\d{${digits}})$`, 'i');
  let max = 0;
  for (const raw of existing) {
    const m = String(raw || '').toUpperCase().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${safe}${String(max + 1).padStart(digits, '0')}`;
};

export const previewKhoaCode = (name?: string, existingCodes: string[] = []) => {
  const base = abbreviateFromName(name || '');
  if (!base) return '';
  return ensureUnique(base, existingCodes);
};

/** Mã quyền — viết tắt từ tên, cùng quy tắc mã khoa. */
export const previewQuyenCode = previewKhoaCode;

export const previewBoMonCode = (name?: string, existingCodes: string[] = []) => {
  const base = abbreviateFromName(name || '');
  if (!base) return '';
  return ensureUnique(base, existingCodes);
};

export const previewLopCode = (
  boMonCode?: string,
  academicYear?: string,
  existingCodes: string[] = [],
) => {
  if (!boMonCode) return '';
  const raw = String(academicYear || '').trim();
  const yy = /^\d{4}$/.test(raw)
    ? raw.slice(2)
    : /^\d{2}$/.test(raw)
      ? raw
      : String(new Date().getFullYear()).slice(2);
  const base = clip(`${String(boMonCode).toUpperCase()}${yy}`);
  return ensureUnique(base, existingCodes);
};

export const previewGiangVienMa = (khoaCode?: string, existingCodes: string[] = []) => {
  if (!khoaCode) return '';
  const digits = 2;
  const prefix = clip(`GV${String(khoaCode).toUpperCase()}`.slice(0, ORG_CODE_MAX_LENGTH - digits));
  return nextSeq(prefix, existingCodes, digits);
};

export const previewSinhVienMa = (lopCode?: string, existingCodes: string[] = []) => {
  if (!lopCode) return '';
  const digits = 4;
  const prefix = clip(String(lopCode).toUpperCase()).slice(0, ORG_CODE_MAX_LENGTH - digits);
  return nextSeq(prefix, existingCodes, digits);
};

export const previewMaHoSo = (existingMaHoSo: string[] = []) => {
  const yy = String(new Date().getFullYear()).slice(2);
  return nextSeq(`HS${yy}`, existingMaHoSo, 4);
};
