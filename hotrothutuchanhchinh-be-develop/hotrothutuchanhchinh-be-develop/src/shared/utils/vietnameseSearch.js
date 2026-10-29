const TONE_VARIANTS = {
  a: 'àáạảãâầấậẩẫăằắặẳẵ',
  e: 'èéẹẻẽêềếệểễ',
  i: 'ìíịỉĩ',
  o: 'òóọỏõôồốộổỗơờớợởỡ',
  u: 'ùúụủũưừứựửữ',
  y: 'ỳýỵỷỹ',
  d: 'đ',
};

const escapeRegexChar = (char) => char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const toBaseLetter = (char) =>
  String(char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

const toRegexCharClass = (char) => {
  const base = toBaseLetter(char);
  const variants = TONE_VARIANTS[base];
  if (!variants) {
    return escapeRegexChar(char);
  }

  const lower = [...new Set(`${base}${variants}`.split(''))].join('');
  const upper = [...new Set(`${base}${variants}`.toUpperCase().split(''))].join('');
  const chars = [...new Set(`${lower}${upper}`.split(''))].join('');
  const escaped = chars.replace(/[\]\\^-]/g, '\\$&');
  return `[${escaped}]`;
};

/** Chuyển từ khóa tìm kiếm thành regex không phân biệt dấu tiếng Việt. */
export const toAccentInsensitiveRegex = (search) => {
  const text = String(search ?? '').trim();
  if (!text) return '';
  return [...text].map(toRegexCharClass).join('');
};

/** Tạo điều kiện $or tìm kiếm không dấu trên nhiều trường. */
export const buildAccentInsensitiveOrFilter = (fields, search) => {
  const pattern = toAccentInsensitiveRegex(search);
  if (!pattern) return null;
  return {
    $or: fields.map((field) => ({ [field]: { $regex: pattern, $options: 'i' } })),
  };
};
