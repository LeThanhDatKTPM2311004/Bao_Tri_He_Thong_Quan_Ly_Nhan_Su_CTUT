import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import * as XLSXNS from 'xlsx';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const XLSX = XLSXNS.default ?? XLSXNS;
const docxPath =
  'd:/file_hoc/Nam_4/Thuc_tap/PM_TTHC2/client/public/mau-word/Giay_xac_nhan_tam_hoan_NVQS.docx';

const result = await mammoth.extractRawText({ path: docxPath });
const matches = result.value.match(/\{([^}%][^}]*)\}/g) || [];
const fields = [
  ...new Set(
    matches
      .map((m) => m.replace(/[{}]/g, '').trim())
      .filter(Boolean),
  ),
];
console.log('FIELDS:', fields.join(', '));

await mongoose.connect(process.env.MONGO_URI);
const students = await mongoose.connection.db
  .collection('users')
  .find({ role: 'student' })
  .project({ fullName: 1, studentId: 1, email: 1 })
  .limit(5)
  .toArray();
console.log('STUDENTS:', students);

const headers = fields.includes('MSSV') ? fields : ['MSSV', ...fields];
const guide = headers.map((h) => `[HD] ${h}`);

const fallback = [
  { studentId: '240801001', fullName: 'Nguyễn Văn A' },
  { studentId: '240801002', fullName: 'Trần Thị B' },
  { studentId: '240801003', fullName: 'Lê Văn C' },
];
const src = students.length ? students : fallback;
const now = new Date();

const sampleRows = src.slice(0, 3).map((s) => {
  const row = {};
  for (const h of headers) {
    const key = h.toUpperCase();
    if (key === 'MSSV') row[h] = s.studentId || '240801001';
    else if (key === 'HO_TEN') row[h] = s.fullName || 'Nguyễn Văn A';
    else if (key === 'TEN_NGUOI_KY') row[h] = 'Nguyễn Văn E';
    else if (key === 'NGAY_SINH') row[h] = '01/01/2004';
    else if (key === 'CCCD') row[h] = '083187028029';
    else if (key === 'KHOA') row[h] = 'Công nghệ thông tin';
    else if (key === 'NGANH') row[h] = 'Hệ thống thông tin';
    else if (key === 'KHOA_HOC') row[h] = '2024';
    else if (key === 'LOP') row[h] = 'HTTT24';
    else if (key === 'LOAI_HINH_DAO_TAO') row[h] = 'Chính quy';
    else if (key === 'THOI_GIAN_DAO_TAO') row[h] = '4 năm';
    else if (key === 'TRINH_DO') row[h] = 'Đại học';
    else if (key === 'NAM_HOC') row[h] = '2025-2026';
    else if (key === 'THOI_GIAN_NHAP_HOC') row[h] = '09/2024';
    else if (key === 'THOI_GIAN_TOT_NGHIEP') row[h] = '06/2028';
    else if (key === 'NGAY_LAM_DON') row[h] = String(now.getDate()).padStart(2, '0');
    else if (key === 'THANG_LAM_DON') row[h] = String(now.getMonth() + 1).padStart(2, '0');
    else if (key === 'NAM_LAM_DON') row[h] = String(now.getFullYear());
    else row[h] = '';
  }
  row['Ghi chú'] = 'Cột dư để test khớp linh hoạt';
  row['Điểm TB'] = '3.2';
  return row;
});

const allHeaders = [...headers, 'Ghi chú', 'Điểm TB'];
const allGuide = [...guide, '[HD] bỏ qua', '[HD] bỏ qua'];
const aoa = [
  allHeaders,
  allGuide,
  ...sampleRows.map((r) => allHeaders.map((h) => r[h] ?? '')),
];

const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = allHeaders.map((h) => ({ wch: Math.min(28, Math.max(12, h.length + 2)) }));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'ImportNVQS');

const stamp = new Date()
  .toISOString()
  .slice(0, 19)
  .replace(/[-:T]/g, '');
const outDir = 'd:/file_hoc/Nam_4/Thuc_tap/PM_TTHC2/client/public/mau-import-excel';
fs.mkdirSync(outDir, { recursive: true });
const out1 = path.join(outDir, 'mau-import-NVQS_mau_he_thong.xlsx');
const out2 = path.join(
  process.env.USERPROFILE,
  'Downloads',
  `mau-import-NVQS_mau_he_thong_${stamp}.xlsx`,
);
XLSX.writeFile(wb, out1);
XLSX.writeFile(wb, out2);
console.log('WROTE', out1);
console.log('WROTE', out2);

await mongoose.disconnect();
