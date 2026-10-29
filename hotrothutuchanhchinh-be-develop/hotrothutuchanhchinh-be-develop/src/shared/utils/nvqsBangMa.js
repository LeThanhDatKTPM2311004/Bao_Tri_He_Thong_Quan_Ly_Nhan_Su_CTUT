/**
 * Bãng mã ngành / thời gian đào tạo (đồng bộ với fe-home nvqsBangMa.js)
 */

const norm = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');

export const NGANH_TRINH_DO = [
  { maNganh: '7380101', tenNganh: 'Luật', trinhDo: 'Cử nhân' },
  { maNganh: '7340101', tenNganh: 'Quản trị kinh doanh', trinhDo: 'Cử nhân' },
  { maNganh: '7340301', tenNganh: 'Kế toán', trinhDo: 'Cử nhân' },
  { maNganh: '7340201', tenNganh: 'Tài chính - Ngân hàng', trinhDo: 'Cử nhân' },
  { maNganh: '7420201', tenNganh: 'Công nghệ sinh học', trinhDo: 'Kỹ sư' },
  { maNganh: '7580302', tenNganh: 'Quản lý xây dựng', trinhDo: 'Kỹ sư' },
  { maNganh: '7510605', tenNganh: 'Logistics và quản lý chuỗi cung ứng', trinhDo: 'Kỹ sư' },
  { maNganh: '7510102', tenNganh: 'Công nghệ kỹ thuật công trình xây dựng', trinhDo: 'Kỹ sư' },
  { maNganh: '7510401', tenNganh: 'Công nghệ kỹ thuật hóa học', trinhDo: 'Kỹ sư' },
  { maNganh: '7510301', tenNganh: 'Công nghệ kỹ thuật điện, điện tử', trinhDo: 'Kỹ sư' },
  { maNganh: '7510303', tenNganh: 'Công nghệ kỹ thuật điều khiển và tự động hóa', trinhDo: 'Kỹ sư' },
  { maNganh: '7510601', tenNganh: 'Quản lý công nghiệp', trinhDo: 'Kỹ sư' },
  { maNganh: '7510203', tenNganh: 'Công nghệ kỹ thuật cơ điện tử', trinhDo: 'Kỹ sư' },
  { maNganh: '7510403', tenNganh: 'Công nghệ kỹ thuật năng lượng', trinhDo: 'Kỹ sư' },
  { maNganh: '7480201', tenNganh: 'Công nghệ thông tin', trinhDo: 'Kỹ sư' },
  { maNganh: '7480104', tenNganh: 'Hệ thống thông tin', trinhDo: 'Kỹ sư' },
  { maNganh: '7480101', tenNganh: 'Khoa học máy tính', trinhDo: 'Kỹ sư' },
  { maNganh: '7480103', tenNganh: 'Kỹ thuật phần mềm', trinhDo: 'Kỹ sư' },
  { maNganh: '7460108', tenNganh: 'Khoa học dữ liệu', trinhDo: 'Kỹ sư' },
  { maNganh: '7540101', tenNganh: 'Công nghệ thực phẩm', trinhDo: 'Kỹ sư' },
  { maNganh: '7520118', tenNganh: 'Kỹ thuật hệ thống công nghiệp', trinhDo: 'Kỹ sư' },
  { maNganh: '7220201', tenNganh: 'Ngôn ngữ Anh', trinhDo: 'Cử nhân' },
];

const TRAINING_RULES = [
  {
    trinhDo: 'Cử nhân',
    he: 'Chính quy',
    thoiGianDaoTao: '3 năm 8 tháng',
    soThang: 44,
    nhapHocMonth: 9,
    raTruongMonth: 5,
    raTruongYearOffset: 4,
  },
  {
    trinhDo: 'Kỹ sư',
    he: 'Chính quy',
    thoiGianDaoTao: '4 năm 4 tháng',
    soThang: 52,
    nhapHocMonth: 9,
    raTruongMonth: 1,
    raTruongYearOffset: 5,
  },
  {
    trinhDo: 'Cử nhân',
    he: 'Vừa làm vừa học',
    thoiGianDaoTao: '4 năm 5 tháng',
    soThang: 53,
    nhapHocMonth: 9,
    raTruongMonth: 2,
    raTruongYearOffset: 5,
  },
  {
    trinhDo: 'Kỹ sư',
    he: 'Vừa làm vừa học',
    thoiGianDaoTao: '5 năm',
    soThang: 60,
    nhapHocMonth: 9,
    raTruongMonth: 9,
    raTruongYearOffset: 5,
  },
];

const normalizeHeDaoTao = (value) => {
  const key = norm(value);
  if (!key) return '';
  if (key.includes('vlvh') || key.includes('vualamvuahoc')) return 'Vừa làm vừa học';
  if (key.includes('chinhquy')) return 'Chính quy';
  return String(value || '').trim();
};

const normalizeTrinhDo = (value) => {
  const key = norm(value);
  if (!key) return '';
  if (key.includes('ky su') || key === 'kysu' || key.includes('engineer')) return 'Kỹ sư';
  if (key.includes('cu nhan') || key === 'cunhan' || key.includes('bachelor')) return 'Cử nhân';
  return String(value || '').trim();
};

export const resolveKhoaYear = (value) => {
  const text = String(value || '').trim();
  if (!text) return null;
  const full = text.match(/(20\d{2})/);
  if (full) return Number(full[1]);
  const short = text.match(/^k?\s*(\d{2})$/i);
  if (short) return 2000 + Number(short[1]);
  return null;
};

export const findNganhMeta = (nganhName) => {
  const key = norm(nganhName);
  if (!key) return null;
  const exact = NGANH_TRINH_DO.find((item) => norm(item.tenNganh) === key);
  if (exact) return exact;
  return (
    NGANH_TRINH_DO.find(
      (item) => key.includes(norm(item.tenNganh)) || norm(item.tenNganh).includes(key),
    ) || null
  );
};

export const resolveTrinhDoFromNganh = (nganhName) => findNganhMeta(nganhName)?.trinhDo || '';

const findTrainingRule = (trinhDo, loaiHinh) => {
  const td = normalizeTrinhDo(trinhDo);
  const he = normalizeHeDaoTao(loaiHinh) || 'Chính quy';
  return TRAINING_RULES.find((rule) => rule.trinhDo === td && rule.he === he) || null;
};

const padMonth = (month) => String(month).padStart(2, '0');

export const resolveTrainingSchedule = ({ khoaHoc, trinhDo, loaiHinhDaoTao } = {}) => {
  const year = resolveKhoaYear(khoaHoc);
  const rule = findTrainingRule(trinhDo, loaiHinhDaoTao);
  if (!year || !rule) return null;

  return {
    thoiGianDaoTao: rule.thoiGianDaoTao,
    soThang: rule.soThang,
    thoiGianNhapHoc: `${padMonth(rule.nhapHocMonth)}/${year}`,
    thoiGianTotNghiep: `${padMonth(rule.raTruongMonth)}/${year + rule.raTruongYearOffset}`,
  };
};

export const resolveScheduleFromStudent = (student = {}) => {
  const nganh = student.nganh || '';
  const trinhDo = resolveTrinhDoFromNganh(nganh) || student.trinhDo || '';
  return resolveTrainingSchedule({
    khoaHoc: student.khoaHoc,
    trinhDo,
    loaiHinhDaoTao: student.loaiHinhDaoTao || 'Chính quy',
  });
};
