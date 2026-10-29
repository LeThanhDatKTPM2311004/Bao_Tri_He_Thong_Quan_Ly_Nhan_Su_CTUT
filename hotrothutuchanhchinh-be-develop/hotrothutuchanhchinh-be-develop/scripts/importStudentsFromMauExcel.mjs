/**
 * Import danh sách SV từ `Dữ liệu mẫu.xlsx` → SinhVien + User.
 * Email: sv{maSV}@student.ctuet.edu.vn | Mật khẩu mặc định: Pmtthc@123
 *
 * Usage: node scripts/importStudentsFromMauExcel.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import * as XLSXNS from 'xlsx';

import Khoa from '../src/modules/organization/models/khoa.model.js';
import BoMon from '../src/modules/organization/models/boMon.model.js';
import Lop from '../src/modules/organization/models/lop.model.js';
import SinhVien from '../src/modules/organization/models/sinhVien.model.js';
import { syncUserFromSinhVien, ORG_SYNC_DEFAULT_PASSWORD } from '../src/modules/organization/orgUserSync.service.js';
import { generateMaHoSo } from '../src/modules/organization/orgCodeGenerate.js';
import { normalizePhone } from '../src/shared/validators/phoneText.js';

const XLSX = XLSXNS.default ?? XLSXNS;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_PATH = path.resolve('d:/file_hoc/Nam_4/Thuc_tap/Dữ liệu mẫu.xlsx');
const KEEP_EMAIL = 'nthoahttt2211016@student.ctuet.edu.vn';

const normalizeKey = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '');

const stripName = (s) =>
  String(s || '')
    .replace(/[^\p{L}\p{N}\s\-–—]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseDate = (raw) => {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + raw * 86400000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const text = String(raw).trim();
  const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
};

const parseGender = (raw) => {
  const t = normalizeKey(raw);
  if (t.startsWith('nam')) return 'male';
  if (t.startsWith('nu')) return 'female';
  return 'male';
};

const mapLoaiHinh = (raw) => {
  const t = normalizeKey(raw);
  if (t === 'vlvh' || t.includes('vualamvuahoc')) return 'Vừa làm vừa học';
  if (t.includes('chinhquy')) return 'Chính quy';
  if (t.includes('lienthong')) return 'Liên thông';
  return String(raw || 'Chính quy').trim() || 'Chính quy';
};

const safePhone = (raw, seed) => {
  let p = normalizePhone(raw);
  // Excel đôi khi mất số 0 đầu
  if (/^[1-9]\d{8,9}$/.test(p)) p = `0${p}`;
  if (/^0\d{9,10}$/.test(p)) return p.slice(0, 11);

  // Sinh SĐT hợp lệ ổn định từ seed (maSV / index)
  const digits = String(seed || '')
    .replace(/\D/g, '')
    .padStart(9, '1')
    .slice(-9);
  return `09${digits}`.slice(0, 10);
};

const codeFromText = (text, fallback, max = 12) => {
  const ascii = normalizeKey(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (ascii) return ascii.slice(0, max);
  return fallback;
};

/** Map tên khoa Excel → khoa hệ thống (ưu tiên khớp đã có). */
const resolveKhoa = async (excelKhoaName, cache) => {
  const name = String(excelKhoaName || '').trim() || 'Khoa chưa xác định';
  const key = normalizeKey(name);
  if (cache.khoa.has(key)) return cache.khoa.get(key);

  const all = await Khoa.find({ isActive: true });
  let found = all.find((k) => normalizeKey(k.name) === key);
  if (!found) {
    found = all.find(
      (k) =>
        normalizeKey(k.name).includes(key) ||
        key.includes(normalizeKey(k.name)) ||
        normalizeKey(k.name).replace(/dien/g, '') === key.replace(/dien/g, ''),
    );
  }
  // Đặc thù dấu gạch Khoa Điện
  if (!found && key.includes('diendientu')) {
    found = all.find((k) => normalizeKey(k.name).includes('diendientu'));
  }
  if (!found && key.includes('xaydung')) {
    found = all.find((k) => normalizeKey(k.name).includes('xaydung'));
  }
  if (!found && key.includes('cokhi')) {
    found = all.find((k) => normalizeKey(k.name).includes('cokhi'));
  }
  if (!found && (key.includes('kinhte') || key.includes('quanlycongnghiep'))) {
    found = all.find((k) => normalizeKey(k.name).includes('kinhte'));
  }
  if (!found && key.includes('congnghethongtin')) {
    found = all.find((k) => normalizeKey(k.name).includes('congnghethongtin'));
  }

  if (!found) {
    let code = codeFromText(name.replace(/^khoa/i, ''), 'KHOA');
    if (code.length < 2) code = `K${Date.now().toString().slice(-4)}`;
    // đảm bảo unique
    let tryCode = code.slice(0, 15);
    let i = 1;
    while (await Khoa.findOne({ code: tryCode })) {
      tryCode = `${code.slice(0, 12)}${i++}`.slice(0, 15);
    }
    found = await Khoa.create({
      code: tryCode,
      name: stripName(name).slice(0, 100),
      isActive: true,
    });
    console.log('[Khoa+] ', found.code, found.name);
  }

  cache.khoa.set(key, found);
  return found;
};

const resolveBoMon = async (khoa, excelNganh, excelChuyenNganh, cache) => {
  const name = stripName(excelChuyenNganh || excelNganh || 'Bộ môn chung').slice(0, 100);
  const key = `${khoa._id}:${normalizeKey(name)}`;
  if (cache.boMon.has(key)) return cache.boMon.get(key);

  let found = await BoMon.findOne({
    khoaId: khoa._id,
    isActive: true,
    name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  if (!found) {
    const list = await BoMon.find({ khoaId: khoa._id, isActive: true });
    found = list.find((b) => normalizeKey(b.name) === normalizeKey(name));
  }
  if (!found) {
    let code = codeFromText(name, 'BM', 10);
    let tryCode = code;
    let i = 1;
    while (await BoMon.findOne({ khoaId: khoa._id, code: tryCode })) {
      tryCode = `${code.slice(0, 8)}${i++}`.slice(0, 12);
    }
    found = await BoMon.create({
      code: tryCode,
      name,
      khoaId: khoa._id,
      isActive: true,
    });
    console.log('[BoMon+]', found.code, found.name, '←', khoa.code);
  }
  cache.boMon.set(key, found);
  return found;
};

const resolveLop = async (khoa, boMon, maLop, tenLop, namVao, cache) => {
  // Mã lớp Excel có thể chứa Đ/đ → chuẩn hoá về ASCII A-Z0-9
  const code = String(maLop || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  if (!code) throw new Error(`Thiếu/mã lớp không hợp lệ: ${maLop}`);
  const key = code;
  if (cache.lop.has(key)) return cache.lop.get(key);

  let found = await Lop.findOne({ code, isActive: true });
  if (!found) {
    const year = String(namVao || '').trim().match(/^\d{4}$/)
      ? String(namVao).trim()
      : '';
    found = await Lop.create({
      code,
      name: stripName(tenLop || code).slice(0, 100),
      khoaId: khoa._id,
      boMonId: boMon._id,
      academicYear: year,
      isActive: true,
    });
    console.log('[Lop+]  ', found.code, found.name);
  }
  cache.lop.set(key, found);
  return found;
};

const buildEmail = (maSV) => `sv${String(maSV).toLowerCase()}@student.ctuet.edu.vn`;

const run = async () => {
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`Không tìm thấy file: ${EXCEL_PATH}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('[Import] Mongo connected');
  console.log('[Import] File:', EXCEL_PATH);
  console.log('[Import] Password mặc định:', ORG_SYNC_DEFAULT_PASSWORD);

  const keepUser = await mongoose.connection.db.collection('users').findOne({
    email: KEEP_EMAIL,
  });
  const keepMaSV = keepUser?.studentId ? String(keepUser.studentId).toUpperCase() : null;

  const wb = XLSX.read(fs.readFileSync(EXCEL_PATH), { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log('[Import] Rows:', rows.length);

  const cache = { khoa: new Map(), boMon: new Map(), lop: new Map() };
  const summary = { success: 0, skipped: 0, errors: [] };
  const sampleAccounts = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    try {
      const maSV = String(r['Mã sinh viên'] ?? '')
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');
      if (!maSV) {
        summary.skipped += 1;
        continue;
      }
      if (!/^[A-Z0-9]+$/.test(maSV) || maSV.length > 15) {
        throw new Error(`Mã SV không hợp lệ: ${maSV}`);
      }
      if (keepMaSV && maSV === keepMaSV) {
        summary.skipped += 1;
        continue;
      }

      const ho = String(r['Họ'] || '').trim();
      const ten = String(r['Tên'] || '').trim();
      const fullName = stripName(`${ho} ${ten}`.trim());
      if (!fullName) throw new Error('Thiếu họ tên');

      const email = buildEmail(maSV);
      if (email === KEEP_EMAIL) {
        summary.skipped += 1;
        continue;
      }

      const khoa = await resolveKhoa(r['Khoa'], cache);
      const boMon = await resolveBoMon(khoa, r['Ngành'], r['Chuyên ngành'], cache);
      const lop = await resolveLop(khoa, boMon, r['Mã lớp'], r['Lớp'], r['Năm vào'], cache);

      const hktt = [r['HKTT phường xã'], r['HKTT tỉnh']].filter(Boolean).join(', ');
      const noiSinh = String(r['Nơi sinh'] || '').trim();
      const phone = safePhone(r['Điện thoại'], maSV);
      const soCCCD = String(r['CCCD'] || '')
        .replace(/\D/g, '')
        .slice(0, 12);

      const maHoSoExisting = await SinhVien.findOne({ maSV }).select('maHoSo');
      const maHoSo = maHoSoExisting?.maHoSo || (await generateMaHoSo());

      const payload = {
        maSV,
        maHoSo,
        fullName,
        gender: parseGender(r['Giới tính']),
        status: String(r['Trạng thái'] || 'Đang học').trim() || 'Đang học',
        ngayVaoTruong: parseDate(r['Ngày nhập học']),
        lopHoc: String(r['Lớp'] || lop.name || '').trim(),
        coSo: '1',
        dienDaoTao: String(r['Hệ đào tạo'] || 'Đại học chính quy').trim(),
        loaiHinhDaoTao: mapLoaiHinh(r['Loại hình ĐT']),
        nganh: String(r['Ngành'] || '').trim(),
        chuyenNganh: String(r['Chuyên ngành'] || r['Ngành'] || '').trim(),
        khoaHoc: String(r['Khóa học'] || r['Năm vào'] || '').trim(),
        dateOfBirth: parseDate(r['Ngày sinh']),
        danToc: 'Kinh',
        tonGiao: 'Không',
        quocTich: 'Việt Nam',
        khuVuc: '2',
        soCCCD: soCCCD || `0${String(maSV).padStart(11, '0')}`.slice(0, 12),
        ngayCapCCCD: parseDate(r['Ngày cấp']),
        noiCapCCCD:
          String(r['Nơi cấp'] || '').trim() ||
          'CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI',
        doiTuong: '',
        chinhSach: '',
        email,
        phone,
        diaChiLienHe: hktt || noiSinh || 'Cần Thơ',
        noiSinh: noiSinh || 'Cần Thơ',
        diaChiThuongTru: hktt || noiSinh || 'Cần Thơ',
        tenNganHang: 'Vietcombank',
        tenChiNhanh: 'CN Cần Thơ',
        tenChuTaiKhoan: fullName,
        soTaiKhoan: `00${String(maSV).replace(/\D/g, '').padStart(10, '0')}`.slice(0, 12),
        hoTenCha: stripName(`Ông ${ten || 'A'}`),
        namSinhCha: '1975',
        ngheNgiepCha: 'Công nhân',
        sdtCha: safePhone('', `${maSV}1`),
        hoTenMe: stripName(`Bà ${ten || 'B'}`),
        namSinhMe: '1978',
        ngheNgiepMe: 'Nội trợ',
        sdtMe: safePhone('', `${maSV}2`),
        khoaId: khoa._id,
        boMonId: boMon._id,
        lopId: lop._id,
        isActive: true,
      };

      const sv = await SinhVien.findOneAndUpdate({ maSV }, payload, {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      });
      await syncUserFromSinhVien(sv);
      summary.success += 1;
      if (sampleAccounts.length < 5) {
        sampleAccounts.push({ maSV, fullName, email });
      }
    } catch (err) {
      summary.errors.push({ line, message: err.message });
      if (summary.errors.length <= 15) {
        console.warn(`[Row ${line}]`, err.message);
      }
    }
  }

  const totalSvUsers = await mongoose.connection.db
    .collection('users')
    .countDocuments({ role: 'student' });
  const totalSv = await SinhVien.countDocuments();

  console.log('\n========== KẾT QUẢ ==========');
  console.log('Thành công:', summary.success);
  console.log('Bỏ qua:', summary.skipped);
  console.log('Lỗi:', summary.errors.length);
  console.log('Tổng SinhVien DB:', totalSv);
  console.log('Tổng User student:', totalSvUsers);
  console.log('Mật khẩu đăng nhập:', ORG_SYNC_DEFAULT_PASSWORD);
  console.log('Mẫu tài khoản:');
  for (const a of sampleAccounts) {
    console.log(`  ${a.maSV} | ${a.fullName} | ${a.email}`);
  }
  if (summary.errors.length) {
    const out = path.join(__dirname, `_import_sv_errors_${Date.now()}.json`);
    fs.writeFileSync(out, JSON.stringify(summary.errors, null, 2), 'utf8');
    console.log('Chi tiết lỗi:', out);
  }

  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error('[Fail]', err);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
