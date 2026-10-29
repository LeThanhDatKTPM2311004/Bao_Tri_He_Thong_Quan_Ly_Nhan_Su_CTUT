import * as XLSXNS from 'xlsx';
import { normalizeOrgCode } from '../../shared/validators/organizationText.js';

/** ESM namespace của `xlsx` chỉ re-export một phần; SSF nằm trên default. */
const XLSX = XLSXNS.default ?? XLSXNS;

const normalizeKey = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');

/** Chuẩn hóa tên để so khớp không phân biệt dấu, hoa thường, tiền tố Khoa/Bộ môn. */
export const normalizeText = (value) =>
  normalizeKey(value).replace(/^(khoa|bomon|bomon|phongban|phong|donvi)/, '');

export const findEntityByNormalizedName = (docs, name) => {
  const target = normalizeText(name);
  if (!target) return null;

  const exact = docs.find((doc) => normalizeText(doc.name) === target);
  if (exact) return exact;

  const contains = docs.find((doc) => {
    const candidate = normalizeText(doc.name);
    return candidate.includes(target) || target.includes(candidate);
  });
  if (contains) return contains;

  const targetWords = target.match(/[a-z0-9]+/g) || [];
  if (targetWords.length === 0) return null;

  let best = null;
  let bestScore = 0;
  for (const doc of docs) {
    const candidate = normalizeText(doc.name);
    const score = targetWords.filter((word) => candidate.includes(word)).length;
    if (score > bestScore) {
      bestScore = score;
      best = doc;
    }
  }

  return bestScore >= Math.min(2, targetWords.length) ? best : null;
};

export const toRowMap = (row) => {
  const map = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith('__')) continue;
    map[normalizeKey(key)] = value;
  }
  if (row.__values) {
    row.__values.forEach((value, index) => {
      map[`__col${index}`] = value;
    });
  }
  return map;
};

export const cell = (map, ...keys) => {
  for (const key of keys) {
    const value = map[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
};

/** true nếu map có bất kỳ key nào (đã normalize) khớp danh sách — kể cả giá trị rỗng */
export const mapHasAnyKey = (map, ...keys) => {
  const wanted = new Set(keys.map((k) => normalizeKey(k)));
  return Object.keys(map).some((k) => !k.startsWith('__') && wanted.has(k));
};

export const isEmptyRow = (map) =>
  Object.entries(map)
    .filter(([key]) => !key.startsWith('__col'))
    .every(([, value]) => value === undefined || value === null || String(value).trim() === '');

/** Dòng hướng dẫn trong file mẫu Excel (ô bắt đầu bằng [HD]) — bỏ qua khi import */
export const isGuideRow = (map) => {
  const values = Object.entries(map)
    .filter(([key]) => !key.startsWith('__'))
    .map(([, value]) => String(value ?? '').trim())
    .filter(Boolean);
  if (!values.length) return false;
  return values.some((value) => /^\[HD\]/i.test(value) || /^\[HƯỚNG DẪN/i.test(value));
};

const scoreHeaderRow = (row) => {
  const rawCells = row.map((c) => String(c ?? '').trim());
  // Dòng hướng dẫn [HD] trong file mẫu — không phải tiêu đề cột
  if (rawCells.some((c) => /^\[HD\]/i.test(c) || /^\[HƯỚNG DẪN/i.test(c))) {
    return -100;
  }
  const cells = rawCells.map((c) => normalizeKey(c));
  let score = 0;
  for (const c of cells) {
    if (!c) continue;
    if (/^(stt|tt|no|#|so)$/.test(c)) score += 2;
    if (/ma|code|ten|name|khoa|bomon|lop|email|sdt|phone|hoten|donvi|kyhieu|viettat/.test(c)) score += 4;
  }
  const nonEmpty = rawCells.filter((c) => c);
  if (nonEmpty.length === 0) return -1;
  // Tiêu đề cột ngắn; dòng mô tả dài trong mẫu Excel thường > 40 ký tự/ô
  const avgLen = nonEmpty.reduce((sum, c) => sum + c.length, 0) / nonEmpty.length;
  if (avgLen > 40) score -= 20;
  const numeric = nonEmpty.filter((c) => !Number.isNaN(Number(c))).length;
  if (numeric / nonEmpty.length > 0.75) score -= 6;
  return score;
};

const findHeaderRowIndex = (matrix) => {
  const maxScan = Math.min(25, matrix.length);
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < maxScan; i++) {
    const score = scoreHeaderRow(matrix[i]);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
};

const buildHeaderNames = (headerRow, rowIndex) => {
  const used = new Set();
  return headerRow.map((cell, colIndex) => {
    let name = String(cell ?? '').trim();
    if (!name || name.startsWith('__EMPTY')) {
      name = `Cot${colIndex + 1}`;
    }
    let unique = name;
    let n = 2;
    while (used.has(normalizeKey(unique))) {
      unique = `${name}_${n++}`;
    }
    used.add(normalizeKey(unique));
    return unique;
  });
};

export const parseExcelRows = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!matrix.length) {
    return { rows: [], detectedHeaders: [], headerRow: 1 };
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const headers = buildHeaderNames(matrix[headerRowIndex], headerRowIndex);
  const rows = [];

  for (let i = headerRowIndex + 1; i < matrix.length; i++) {
    const rowArr = matrix[i];
    const obj = { __values: rowArr.map((v) => (v === undefined || v === null ? '' : v)) };
    headers.forEach((header, colIndex) => {
      obj[header] = rowArr[colIndex] ?? '';
    });
    const map = toRowMap(obj);
    if (isEmptyRow(map) || isGuideRow(map)) continue;
    rows.push(obj);
  }

  return {
    rows,
    detectedHeaders: headers.filter((h) => !h.startsWith('Cot')),
    headerRow: headerRowIndex + 1,
  };
};

/** Lấy giá trị theo tên cột; nếu không có thì thử cột 1-2 (bỏ STT). */
export const cellWithFallback = (map, keys, colIndex) => {
  const direct = cell(map, ...keys);
  if (direct) return direct;
  const positional = map[`__col${colIndex}`];
  if (positional !== undefined && positional !== null && String(positional).trim() !== '') {
    return String(positional).trim();
  }
  return '';
};

export const giangVienRowFields = (map) => ({
  khoaCode: cell(map, 'khoaCode', 'maKhoa', 'makhoa', 'ma khoa', 'Mã khoa', 'Ma khoa').toUpperCase(),
  boMonCode: cell(map, 'boMonCode', 'maBoMon', 'mabomon', 'ma bo mon', 'Mã bộ môn', 'Ma bo mon').toUpperCase(),
  khoaName: cell(map, 'khoa', 'tenKhoa', 'tenkhoa', 'ten khoa', 'Khoa', 'Tên khoa', 'Don vi', 'don vi', 'Đơn vị'),
  boMonName: cell(map, 'boMon', 'boMon', 'bomon', 'tenBoMon', 'tenbomon', 'ten bo mon', 'Bộ môn', 'Bo mon', 'Tên bộ môn'),
  maGV: normalizeOrgCode(cell(map, 'maGV', 'magv', 'ma gv', 'Ma GV', 'Mã GV')),
  fullName: cell(map, 'fullName', 'hoTen', 'hoten', 'ho ten', 'Họ tên', 'Ho va ten', 'Tên', 'Ten'),
  email: cell(map, 'email', 'Email').toLowerCase(),
  phone: cell(map, 'phone', 'sdt', 'SDT', 'SĐT', 'dien thoai', 'Điện thoại', 'SoDienThoai', 'so dien thoai'),
  /** Mã lớp cố vấn (không bắt buộc); mã lớp hoặc tên lớp; nhiều lớp cách nhau bằng dấu phẩy / ; */
  lopCoVanCodes: cell(
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
  ),
});

/** Chuyển giá trị Excel (chuỗi / số serial / Date) thành Date hoặc null. */
export const parseExcelDate = (value) => {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parseDateCode = XLSX.SSF?.parse_date_code;
    if (typeof parseDateCode !== 'function') return null;
    const parsed = parseDateCode(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
  }
  const text = String(value).trim();
  if (!text) return null;
  const dmy = text.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

const looksLikeExcelSerialDate = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 20000 && value <= 80000;

/**
 * Đưa giá trị ô Excel vào placeholder mẫu đơn.
 * Số serial ngày (vd. 47635) → 06/2030 hoặc 01/06/2030 tùy trường.
 */
export const formatExcelFormValue = (raw, placeHolder = '') => {
  if (raw == null || raw === '') return '';

  const ph = String(placeHolder || '').toUpperCase();
  let date = null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    date = raw;
  } else if (looksLikeExcelSerialDate(raw)) {
    date = parseExcelDate(raw);
  }

  if (date) {
    const day = date.getUTCDate();
    const month = date.getUTCMonth() + 1;
    const year = date.getUTCFullYear();
    if (ph === 'NGAY_LAM_DON') return String(day);
    if (ph === 'THANG_LAM_DON') return String(month);
    if (ph === 'NAM_LAM_DON') return String(year);
    if (/NHAP_HOC|TOT_NGHIEP/.test(ph) || (/THOI_GIAN/.test(ph) && !/DAO_TAO/.test(ph))) {
      return `${String(month).padStart(2, '0')}/${year}`;
    }
    if (/NGAY_SINH|NGAY/.test(ph)) {
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    }
    return `${String(month).padStart(2, '0')}/${year}`;
  }

  return String(raw).trim();
};

export const cellRaw = (map, ...keys) => {
  for (const key of keys) {
    const value = map[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return '';
};

const parseGender = (value) => {
  const text = String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!text) return null;
  if (['nam', 'male', 'm', 'namgioi'].includes(text)) return 'male';
  if (['nu', 'female', 'f', 'nugioi'].includes(text)) return 'female';
  if (['khac', 'other', 'o'].includes(text)) return 'other';
  return null;
};

const clipText = (value, max) => String(value ?? '').trim().slice(0, max);

/** Số điện thoại từ Excel: bỏ nháy, lấy chữ số, thêm 0 nếu Excel làm mất số 0 đầu. */
export const normalizeImportPhone = (value) => {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('84') && digits.length >= 11 && digits.length <= 12) {
    digits = `0${digits.slice(2)}`;
  }
  if (!digits.startsWith('0') && (digits.length === 9 || digits.length === 10)) {
    digits = `0${digits}`;
  }
  return /^0\d{9,10}$/.test(digits) ? digits : '';
};

const normalizeImportCccd = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length === 9 || digits.length === 12 ? digits : '';
};

const normalizeImportBankAccount = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 6 && digits.length <= 20 ? digits : '';
};

const rawCol = (map, index) => {
  const value = map[`__col${index}`];
  return value === undefined || value === null ? '' : value;
};

const textCol = (map, index) => clipText(rawCol(map, index), 1000);

const LOAI_HINH_VALUES = new Set([
  'Chính quy',
  'Liên thông',
  'Văn bằng 2',
  'Vừa làm vừa học',
  'Đào tạo ngắn hạn, bồi dưỡng, cấp chứng chỉ',
  'Liên kết đào tạo',
]);

/**
 * File học vụ nhà trường: header trùng (hai cột Nghề nghiệp) và họ/tên tách cột.
 * Đọc theo vị trí cột, không theo tên header.
 */
const applySchoolHocVuColumns = (map, fields) => {
  const hoDem = textCol(map, 3);
  const ten = textCol(map, 4);
  fields.fullName = [hoDem, ten].filter(Boolean).join(' ');
  fields.maHoSo = clipText(textCol(map, 1), 50);
  fields.maSV = normalizeOrgCode(textCol(map, 2));
  fields.gender = parseGender(textCol(map, 5));
  fields.dateOfBirth = parseExcelDate(rawCol(map, 6));
  fields.ngayVaoTruong = parseExcelDate(rawCol(map, 7));
  fields.noiSinh = clipText(textCol(map, 8), 255);
  fields.nguyenQuan = clipText(textCol(map, 9), 255);
  fields.quanHuyen = clipText(textCol(map, 10), 150);
  fields.phuongXa = clipText(textCol(map, 11), 150);
  fields.danToc = clipText(textCol(map, 12), 50);
  fields.tonGiao = clipText(textCol(map, 13), 50);
  fields.diaChiThuongTru = clipText(textCol(map, 14), 255);
  fields.diaChiLienHe = clipText(textCol(map, 15), 255);
  fields.doiTuong = clipText(textCol(map, 16), 100);
  fields.chinhSach = clipText(textCol(map, 17), 100);
  fields.khuVuc = clipText(textCol(map, 18), 50);
  fields.tenTinh = clipText(textCol(map, 19), 150);
  fields.tenHuyen = clipText(textCol(map, 20), 150);
  fields.tenPhanHe = clipText(textCol(map, 21), 100);
  fields.truongTotNghiep = clipText(textCol(map, 22), 255);
  fields.ngayVaoDoan = parseExcelDate(rawCol(map, 23));
  fields.ngayVaoDang = parseExcelDate(rawCol(map, 24));
  fields.soCCCD = normalizeImportCccd(rawCol(map, 25));
  fields.ngayCapCCCD = parseExcelDate(rawCol(map, 26));
  fields.noiCapCCCD = clipText(textCol(map, 27), 150);
  fields.lopCode = textCol(map, 28).toUpperCase();
  fields.lopHoc = clipText(textCol(map, 29), 100);
  fields.khoaToChuc = textCol(map, 30);
  const year = textCol(map, 31);
  if (/^\d{4}$/.test(year)) {
    fields.khoaHoc = `K${year.slice(2)}`;
    fields.academicYearForLop = year;
  } else {
    fields.khoaHoc = clipText(year, 50);
    fields.academicYearForLop = (year.match(/20\d{2}/) || [''])[0];
  }
  fields.dienDaoTao = clipText(textCol(map, 32), 100);
  const loai = textCol(map, 33);
  fields.loaiHinhDaoTao = LOAI_HINH_VALUES.has(loai) ? loai : 'Chính quy';
  fields.nganh = clipText(textCol(map, 34), 150);
  fields.chuyenNganh = clipText(textCol(map, 35), 150);
  fields.nienKhoa = clipText(textCol(map, 36), 50);
  fields.hoTenCha = clipText(textCol(map, 37), 100);
  fields.ngheNgiepCha = clipText(textCol(map, 38), 100);
  fields.hoTenMe = clipText(textCol(map, 39), 100);
  fields.ngheNgiepMe = clipText(textCol(map, 40), 100);
  fields.phone = normalizeImportPhone(rawCol(map, 41));
  const schoolEmail = textCol(map, 43);
  const otherEmail = textCol(map, 42);
  fields.email = (schoolEmail || otherEmail).toLowerCase();
  fields.status = clipText(textCol(map, 44), 100);
  fields.quocTich = clipText(textCol(map, 45), 50);
  fields.soTaiKhoan = normalizeImportBankAccount(rawCol(map, 46));
  fields.tenNganHang = clipText(textCol(map, 47), 100);
  fields.ghiChu = clipText(textCol(map, 48), 500);
};

/** Map đầy đủ cột Excel sinh viên (chỉ lấy cột có trong header/file). */
export const sinhVienRowFields = (map) => {
  const fields = {
  lopCode: cell(map, 'lopCode', 'maLop', 'malop', 'ma lop', 'Mã lớp', 'Lop', 'Lớp', 'MaLop').toUpperCase(),
  maSV: normalizeOrgCode(cell(
    map,
    'maSV',
    'masv',
    'ma sv',
    'Mã SV',
    'MaSV',
    'Ma SV',
    'maSoSV',
    'masosv',
    'ma so sv',
    'Mã Số SV',
    'Mã số SV',
    'Ma so SV',
    'Mã HS-SV',
    'ma hs-sv',
  )),
  maHoSo: cell(
    map,
    'maHoSo',
    'mahoso',
    'ma ho so',
    'Mã Hồ Sơ',
    'Mã hồ sơ',
    'maHoSoHocVu',
    'mahoso hoc vu',
    'Mã hồ sơ học vụ',
  ),
  fullName: cell(map, 'fullName', 'hoTen', 'hoten', 'ho ten', 'Họ và Tên', 'Họ tên', 'HoTen', 'Ho va ten'),
  gender: parseGender(cell(map, 'gender', 'gioiTinh', 'gioitinh', 'gioi tinh', 'Giới Tính', 'Giới tính')),
  status: cell(map, 'status', 'trangThai', 'trangthai', 'trang thai', 'Trạng Thái', 'Trạng thái'),
  ngayVaoTruong: parseExcelDate(cellRaw(map, 'ngayVaoTruong', 'ngayvaotruong', 'ngay vao truong', 'Ngày Vào Trường', 'Ngày vào trường', 'Ngày nhập học', 'ngay nhap hoc')),
  lopHoc: cell(map, 'lopHoc', 'lophoc', 'lop hoc', 'Lớp Học', 'Lớp học'),
  coSo: cell(map, 'coSo', 'coso', 'co so', 'Cơ Sở', 'Cơ sở'),
  dienDaoTao: cell(
    map,
    'dienDaoTao',
    'diendaotao',
    'dien dao tao',
    'Diện Đào Tạo',
    'Diện đào tạo',
    'bacDaoTao',
    'bacdaotao',
    'bac dao tao',
    'Bậc Đào Tạo',
    'Bậc đào tạo',
  ),
  loaiHinhDaoTao: cell(map, 'loaiHinhDaoTao', 'loaihinhdaotao', 'loai hinh dao tao', 'Loại Hình Đào Tạo', 'Loại hình đào tạo'),
  nganh: cell(
    map,
    'nganh',
    'Nganh',
    'Ngành',
    'khoa',
    'tenKhoa',
    'ten khoa',
    'Khoa',
    'Tên khoa',
  ),
  chuyenNganh: cell(
    map,
    'chuyenNganh',
    'chuyennganh',
    'chuyen nganh',
    'Chuyên Ngành',
    'Chuyên ngành',
    'boMon',
    'bomon',
    'tenBoMon',
    'ten bo mon',
    'Bộ môn',
    'Tên bộ môn',
  ),
  khoaHoc: cell(map, 'khoaHoc', 'khoahoc', 'khoa hoc', 'Khóa Học', 'Khóa học'),
  dateOfBirth: parseExcelDate(cellRaw(map, 'dateOfBirth', 'ngaySinh', 'ngaysinh', 'ngay sinh', 'Ngày Sinh', 'Ngày sinh')),
  danToc: cell(map, 'danToc', 'dantoc', 'dan toc', 'Dân Tộc', 'Dân tộc'),
  tonGiao: cell(map, 'tonGiao', 'tongiao', 'ton giao', 'Tôn Giáo', 'Tôn giáo'),
  quocTich: cell(map, 'quocTich', 'quoctich', 'quoc tich', 'Quốc Tịch', 'Quốc tịch'),
  khuVuc: cell(map, 'khuVuc', 'khuvuc', 'khu vuc', 'Khu Vực', 'Khu vực'),
  soCCCD: normalizeImportCccd(cell(map, 'soCCCD', 'socccd', 'so cccd', 'cccd', 'CMND', 'Số CCCD', 'Số CMND', 'so cmnd')),
  ngayCapCCCD: parseExcelDate(cellRaw(map, 'ngayCapCCCD', 'ngaycapcccd', 'ngay cap', 'Ngày Cấp', 'Ngày cấp')),
  noiCapCCCD: cell(map, 'noiCapCCCD', 'noicapcccd', 'noi cap', 'Nơi Cấp', 'Nơi cấp'),
  doiTuong: cell(map, 'doiTuong', 'doituong', 'doi tuong', 'Đối Tượng', 'Đối tượng'),
  chinhSach: cell(
    map,
    'chinhSach',
    'chinhsach',
    'chinh sach',
    'Chính Sách',
    'Chính sách',
    'dienChinhSach',
    'dienchinhsach',
    'dien chinh sach',
    'Diện Chính Sách',
    'Diện chính sách',
  ),
  ngayVaoDoan: parseExcelDate(cellRaw(map, 'ngayVaoDoan', 'ngayvaodoan', 'ngay vao doan', 'Ngày Vào Đoàn', 'Ngày vào Đoàn')),
  ngayVaoDang: parseExcelDate(cellRaw(map, 'ngayVaoDang', 'ngayvaodang', 'ngay vao dang', 'Ngày Vào Đảng', 'Ngày vào Đảng')),
  email: (
    cell(map, 'emaiTruong', 'emailTruong', 'Emai Trường', 'Email trường', 'Email Trường')
    || cell(map, 'email', 'Email')
  ).toLowerCase(),
  phone: normalizeImportPhone(cell(map, 'phone', 'sdt', 'SDT', 'SĐT', 'dienThoai', 'dienthoai', 'dien thoai', 'Điện Thoại', 'Điện thoại')),
  diaChiLienHe: cell(map, 'diaChiLienHe', 'diachilienhe', 'dia chi lien he', 'Địa Chỉ Liên Hệ', 'Địa chỉ liên hệ'),
  noiSinh: cell(map, 'noiSinh', 'noisinh', 'noi sinh', 'Nơi Sinh', 'Nơi sinh'),
  diaChiThuongTru: cell(
    map,
    'diaChiThuongTru',
    'diachithuongtru',
    'dia chi thuong tru',
    'Địa Chỉ Thường Trú',
    'Địa chỉ thường trú',
    'hoKhauThuongTru',
    'hokhauthuongtru',
    'ho khau thuong tru',
    'Hộ Khẩu Thường Trú',
    'Hộ khẩu thường trú',
  ),
  tenNganHang: cell(map, 'tenNganHang', 'tennganhang', 'ten ngan hang', 'Tên Ngân Hàng', 'Tên ngân hàng', 'Ngân hàng'),
  tenChiNhanh: cell(map, 'tenChiNhanh', 'tenchinhanh', 'ten chi nhanh', 'Tên Chi Nhánh', 'Tên chi nhánh'),
  tenChuTaiKhoan: cell(map, 'tenChuTaiKhoan', 'tenchutaikhoan', 'ten chu tai khoan', 'Tên Chủ Tài Khoản', 'Tên chủ tài khoản'),
  soTaiKhoan: normalizeImportBankAccount(cell(map, 'soTaiKhoan', 'sotaikhoan', 'so tai khoan', 'Số Tài Khoản', 'Số tài khoản', 'ATM')),
  hoTenCha: cell(map, 'hoTenCha', 'hotencha', 'ho ten cha', 'Họ Tên Cha', 'Họ tên cha'),
  namSinhCha: cell(map, 'namSinhCha', 'namsinhcha', 'nam sinh cha', 'Năm Sinh (Cha)', 'Năm sinh (cha)'),
  ngheNgiepCha: cell(map, 'ngheNgiepCha', 'nghenghiepcha', 'nghe nghiep cha', 'Nghề Nghiệp (Cha)', 'Nghề nghiệp (cha)', 'Nghề nghiệp'),
  sdtCha: normalizeImportPhone(cell(map, 'sdtCha', 'sdtcha', 'sdt cha', 'SĐT Cha', 'SĐT cha')),
  hoTenMe: cell(map, 'hoTenMe', 'hotenme', 'ho ten me', 'Họ Tên Mẹ', 'Họ tên mẹ'),
  namSinhMe: cell(map, 'namSinhMe', 'namsinhme', 'nam sinh me', 'Năm Sinh (Mẹ)', 'Năm sinh (mẹ)'),
  ngheNgiepMe: cell(map, 'ngheNgiepMe', 'nghenghiepme', 'nghe nghiep me', 'Nghề Nghiệp (Mẹ)', 'Nghề nghiệp (mẹ)', 'Nghề nghiệp_2'),
  sdtMe: normalizeImportPhone(cell(map, 'sdtMe', 'sdtme', 'sdt me', 'SĐT Mẹ', 'SĐT mẹ')),
  nguyenQuan: cell(map, 'nguyenQuan', 'nguyenquan', 'nguyen quan', 'Nguyên quán'),
  quanHuyen: cell(map, 'quanHuyen', 'quanhuyen', 'quan huyen', 'Quận/Huyện', 'Quận huyện'),
  phuongXa: cell(map, 'phuongXa', 'phuongxa', 'phuong xa', 'Phường/Xã', 'Phường xã'),
  tenTinh: cell(map, 'tenTinh', 'tentinh', 'ten tinh', 'Tên tỉnh'),
  tenHuyen: cell(map, 'tenHuyen', 'tenhuyen', 'ten huyen', 'Tên huyện'),
  tenPhanHe: cell(map, 'tenPhanHe', 'tenphanhe', 'ten phan he', 'Tên phân hệ'),
  truongTotNghiep: cell(map, 'truongTotNghiep', 'truongtotnghiep', 'truong tot nghiep', 'Trường tốt nghiệp'),
  nienKhoa: cell(map, 'nienKhoa', 'nienkhoa', 'nien khoa', 'Niên khóa'),
  ghiChu: cell(map, 'ghiChu', 'ghichu', 'ghi chu', 'Ghi chú'),
  khoaToChuc: '',
  academicYearForLop: '',
  };
  if (Object.prototype.hasOwnProperty.call(map, 'mahssv')) {
    applySchoolHocVuColumns(map, fields);
  }
  return fields;
};

export const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const khoaFields = (map, detectedHeaders = []) => {
  const headerStr = detectedHeaders.map((h) => normalizeKey(h)).join(' ');
  const wrongFile = /masv|magv|hoten|hovaten|malop|ngaysinh|namsinh|gioitinh|dienthoai|email/.test(headerStr);

  let code = cell(map,
    'code', 'makhoa', 'makho', 'madonvi', 'madv', 'kyhieu', 'viettat',
    'Mã khoa', 'Ma khoa', 'Ký hiệu',
  );
  let name = cell(map,
    'name', 'ten', 'tenkhoa', 'tenkho', 'tendonvi', 'tendv', 'donvi', 'ten don vi',
    'Ten', 'Tên', 'Tên khoa', 'Ten khoa', 'Tên đơn vị',
  );

  // Chỉ dùng cột vị trí khi thiếu cả mã và tên theo header (file cũ không chuẩn)
  if (!wrongFile && !code && !name) {
    const col0 = cellWithFallback(map, ['stt', 'tt'], 0);
    const col1 = cellWithFallback(map, [], 1);
    const col2 = cellWithFallback(map, [], 2);

    if (col1 && col2) {
      const skipStt = col0 && /^\d+$/.test(col0);
      code = skipStt ? col1 : col0;
      name = skipStt ? col2 : col1;
    } else if (col0) {
      name = col0;
    } else if (col1) {
      name = col1;
    }
  }

  return {
    code: code.toUpperCase(),
    name,
    wrongFile,
  };
};
