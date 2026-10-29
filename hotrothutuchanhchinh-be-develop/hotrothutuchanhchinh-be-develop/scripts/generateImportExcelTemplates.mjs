/**
 * Tạo lại file mẫu Excel import (có dòng hướng dẫn [HD] từng cột).
 * Chạy: npm run excel:templates  (trong thư mục server)
 *
 * Cột mã thực thể (mã khoa/BM/lớp/GV/SV/hồ sơ) không có trong mẫu —
 * hệ thống tự sinh khi import. Cột mã tham chiếu (vd Mã khoa khi import bộ môn) vẫn giữ.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSXNS from 'xlsx';

const XLSX = XLSXNS.default ?? XLSXNS;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../..'); // PM_TTHC2
const publicDir = path.join(projectRoot, 'client/public/mau-import-excel');
const docsDir = path.join(projectRoot, 'mau-import-excel');

const HD = (text) => `[HD] ${text}`;

const writeTemplate = (fileName, sheetName, headers, guides, sample, noteRows = []) => {
  const aoa = [
    headers,
    guides.map(HD),
    sample,
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws['!cols'] = headers.map((h, i) => {
    const guideLen = String(guides[i] || '').length + 6;
    const headerLen = String(h || '').length + 2;
    return { wch: Math.min(48, Math.max(14, headerLen, Math.ceil(guideLen * 0.55))) };
  });

  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  if (noteRows.length) {
    const noteSheet = XLSX.utils.aoa_to_sheet([
      ['Hướng dẫn import'],
      ...noteRows.map((line) => [line]),
    ]);
    noteSheet['!cols'] = [{ wch: 90 }];
    XLSX.utils.book_append_sheet(wb, noteSheet, 'Huong_dan');
  }

  for (const dir of [publicDir, docsDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const publicPath = path.join(publicDir, fileName);
  XLSX.writeFile(wb, publicPath);
  console.log('Wrote', publicPath);
  return wb;
};

const commonNotes = [
  'Dòng 1 = tiêu đề cột (giữ nguyên tên cột).',
  'Dòng 2 = hướng dẫn (ô bắt đầu bằng [HD]) — hệ thống BỎ QUA khi import, có thể xóa dòng này.',
  'Dòng 3 trở đi = dữ liệu thật. Có thể sửa/xóa dòng mẫu rồi thêm dòng mới.',
  'Không cần điền mã — hệ thống tự sinh mã thực thể và khớp đơn vị theo TÊN (hoặc theo khoa/bộ môn/lớp đang chọn trên giao diện).',
  'Thứ tự import khuyến nghị: Khoa → Bộ môn → Giảng viên → Lớp → Sinh viên.',
];

// ── Khoa ──
writeTemplate(
  'mau-khoa.xlsx',
  'Khoa',
  ['Tên khoa', 'Mô tả'],
  [
    'Bắt buộc. Tên đầy đủ khoa, có dấu tiếng Việt. Vd: Khoa Công nghệ thông tin',
    'Không bắt buộc. Mô tả ngắn về khoa',
  ],
  ['Khoa Xây dựng', ''],
  [
    ...commonNotes,
    'File dùng cho tab Khoa (trang Khoa & Bộ môn).',
    'Mã khoa được tự sinh viết tắt từ tên (vd: Khoa Xây dựng → XD).',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-khoa.xlsx'), path.join(docsDir, '01_Khoa.xlsx'));

// ── Bộ môn ──
writeTemplate(
  'mau-bo-mon.xlsx',
  'BoMon',
  ['Tên khoa', 'Tên bộ môn', 'Mô tả'],
  [
    'Bắt buộc nếu chưa chọn khoa trên giao diện. Trùng tên khoa đã có. Vd: Khoa Xây dựng',
    'Bắt buộc. Tên bộ môn đầy đủ. Vd: Kết cấu công trình',
    'Không bắt buộc. Mô tả ngắn về bộ môn',
  ],
  ['Khoa Xây dựng', 'Kết cấu công trình', ''],
  [
    ...commonNotes,
    'File dùng cho tab Bộ môn. Có thể chọn sẵn khoa trên UI rồi bỏ trống cột Tên khoa.',
    'Mã bộ môn tự sinh viết tắt từ tên (vd: Kết cấu công trình → KCCT).',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-bo-mon.xlsx'), path.join(docsDir, '02_BoMon.xlsx'));

// ── Giảng viên ──
writeTemplate(
  'mau-giang-vien.xlsx',
  'GiangVien',
  ['Họ tên', 'Email', 'SĐT', 'Tên khoa', 'Tên bộ môn', 'Lớp cố vấn'],
  [
    'Bắt buộc. Họ tên đầy đủ, có dấu. Vd: Nguyễn Văn A',
    'Bắt buộc. Email thường (Gmail…), không dùng @student.ctuet.edu.vn. Vd: nva@gmail.com',
    'Không bắt buộc. Bắt đầu bằng 0, 10–11 số. Vd: 0901234567',
    'Bắt buộc nếu chưa chọn khoa trên UI. Trùng tên khoa đã có. Vd: Khoa Xây dựng',
    'Bắt buộc nếu chưa chọn bộ môn trên UI. Trùng tên bộ môn đã có. Vd: Kết cấu công trình',
    'Không bắt buộc. Tên lớp hoặc mã lớp đã có; nhiều lớp cách nhau bằng dấu phẩy',
  ],
  ['Nguyễn Văn A', 'nguyenvana@gmail.com', '0901234567', 'Khoa Xây dựng', 'Kết cấu công trình', ''],
  [
    ...commonNotes,
    'Mã GV tự sinh theo khoa (vd: GVXD01). Import lại cùng email sẽ cập nhật hồ sơ cũ.',
    'Cột Lớp cố vấn có thể để trống nếu chưa tạo lớp; gán sau trên trang Giảng viên.',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-giang-vien.xlsx'), path.join(docsDir, '03_GiangVien.xlsx'));

// ── Lớp ──
writeTemplate(
  'mau-lop.xlsx',
  'Lop',
  ['Tên khoa', 'Tên bộ môn', 'Tên lớp', 'Niên khóa', 'Cố vấn'],
  [
    'Bắt buộc nếu chưa chọn khoa trên UI. Trùng tên khoa đã có. Vd: Khoa Xây dựng',
    'Bắt buộc nếu chưa chọn bộ môn trên UI. Trùng tên bộ môn đã có. Vd: Kết cấu công trình',
    'Bắt buộc. Tên lớp đầy đủ. Vd: Kết cấu 2024',
    'Không bắt buộc. Niên khóa 4 chữ số. Vd: 2024 (cũng nhận cột Năm học)',
    'Không bắt buộc. Họ tên hoặc mã GV cố vấn đã có. Vd: Nguyễn Văn A',
  ],
  ['Khoa Xây dựng', 'Kết cấu công trình', 'Kết cấu 2024', '2024', 'Nguyễn Văn A'],
  [
    ...commonNotes,
    'File dùng cho tab Lớp (trang Lớp & Sinh viên). Có thể chọn sẵn bộ môn trên UI.',
    'Mã lớp tự sinh từ mã bộ môn + niên khóa (vd: KCCT24).',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-lop.xlsx'), path.join(docsDir, '04_Lop.xlsx'));

// ── Sinh viên ──
const SV_NOI_CAP_DEFAULT =
  'CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI';

writeTemplate(
  'mau-sinh-vien.xlsx',
  'SinhVien',
  [
    'Họ tên',
    'Giới tính',
    'Trạng thái',
    'Ngày vào trường',
    'Lớp',
    'Cơ sở',
    'Diện đào tạo',
    'Loại hình đào tạo',
    'Khoa',
    'Bộ môn',
    'Khóa học',
    'Ngày sinh',
    'Dân tộc',
    'Tôn giáo',
    'Quốc tịch',
    'Khu vực',
    'Số CCCD',
    'Ngày cấp',
    'Nơi cấp',
    'Đối tượng',
    'Chính sách',
    'Ngày vào Đoàn',
    'Ngày vào Đảng',
    'Email',
    'SĐT',
    'Địa chỉ liên hệ',
    'Nơi sinh',
    'Địa chỉ thường trú',
    'Tên ngân hàng',
    'Tên chi nhánh',
    'Tên chủ tài khoản',
    'Số tài khoản',
    'Họ tên cha',
    'Năm sinh (cha)',
    'Nghề nghiệp (cha)',
    'SĐT cha',
    'Họ tên mẹ',
    'Năm sinh (mẹ)',
    'Nghề nghiệp (mẹ)',
    'SĐT mẹ',
  ],
  [
    'Bắt buộc. Họ tên đầy đủ, có dấu. Vd: Trần Thị B',
    'Bắt buộc. Nam / Nữ / Khác (mặc định Nam)',
    'Bắt buộc. Đang học | Bảo lưu | Thôi học | Đã tốt nghiệp | Đình chỉ',
    'Bắt buộc. YYYY-MM-DD hoặc DD/MM/YYYY. Vd: 2022-09-01',
    'Bắt buộc nếu chưa chọn lớp trên UI. Tên lớp hoặc mã lớp đã có',
    'Bắt buộc. 1 | 2 | 3 (Cơ sở 1/2/3)',
    'Không bắt buộc. Diện đào tạo',
    'Bắt buộc. Chính quy | Liên thông | Văn bằng 2 | Vừa làm vừa học | Đào tạo ngắn hạn, bồi dưỡng, cấp chứng chỉ | Liên kết đào tạo',
    'Lấy theo lớp (có thể bỏ trống nếu đã chọn lớp trên UI). Trùng tên khoa đã có',
    'Lấy theo lớp (có thể bỏ trống nếu đã chọn lớp trên UI). Trùng tên bộ môn đã có',
    'Lấy theo niên khóa lớp. Vd niên khóa 2022 → K22 (có thể bỏ trống)',
    'Bắt buộc. YYYY-MM-DD hoặc DD/MM/YYYY. Vd: 2004-05-20',
    'Bắt buộc. Vd: Kinh',
    'Không bắt buộc',
    'Bắt buộc. Vd: Việt Nam',
    'Không bắt buộc',
    'Bắt buộc. 9 hoặc 12 chữ số. Vd: 001234567890',
    'Bắt buộc. Ngày cấp CCCD. YYYY-MM-DD hoặc DD/MM/YYYY',
    'Bắt buộc. Một trong: CỤC TRƯỞNG CỤC CẢNH SÁT QUẢN LÝ HÀNH CHÍNH VỀ TRẬT TỰ XÃ HỘI | CỤC TRƯỞNG CỤC CẢNH SÁT ĐĂNG KÝ, QUẢN LÝ CƯ TRÚ VÀ DỮ LIỆU QUỐC GIA VỀ DÂN CƯ | BỘ CÔNG AN',
    'Không bắt buộc',
    'Không bắt buộc',
    'Không bắt buộc',
    'Không bắt buộc',
    'Bắt buộc. Phải đuôi @student.ctuet.edu.vn. Vd: sv240801@student.ctuet.edu.vn',
    'Bắt buộc. Bắt đầu bằng 0, 10–11 số. Vd: 0912345678',
    'Bắt buộc',
    'Bắt buộc',
    'Bắt buộc',
    'Bắt buộc',
    'Bắt buộc',
    'Bắt buộc',
    'Bắt buộc. 6–20 chữ số',
    'Bắt buộc',
    'Bắt buộc. 4 chữ số. Vd: 1975',
    'Bắt buộc',
    'Bắt buộc. Bắt đầu bằng 0, 10–11 số',
    'Bắt buộc',
    'Bắt buộc. 4 chữ số. Vd: 1978',
    'Bắt buộc',
    'Bắt buộc. Bắt đầu bằng 0, 10–11 số',
  ],
  [
    'Trần Thị B',
    'Nam',
    'Đang học',
    '2022-09-01',
    'Kết cấu 2024',
    '1',
    '',
    'Chính quy',
    'Khoa Công nghệ thông tin',
    'Công nghệ phần mềm',
    'K22',
    '2004-05-20',
    'Kinh',
    '',
    'Việt Nam',
    '',
    '001234567890',
    '2021-01-15',
    SV_NOI_CAP_DEFAULT,
    '',
    '',
    '',
    '',
    'sv240801@student.ctuet.edu.vn',
    '0912345678',
    'Cần Thơ',
    'Cần Thơ',
    'Cần Thơ',
    'Vietcombank',
    'CN Cần Thơ',
    'Trần Thị B',
    '0123456789',
    'Trần Văn A',
    '1975',
    'Công nhân',
    '0901111111',
    'Nguyễn Thị C',
    '1978',
    'Nội trợ',
    '0902222222',
  ],
  [
    ...commonNotes,
    'Mẫu đồng bộ form Thêm sinh viên trên admin (cột bắt buộc / combobox giống giao diện).',
    'Không bắt buộc chỉ: Diện đào tạo, Khu vực, Tôn giáo, Đối tượng, Chính sách, Ngày vào Đoàn, Ngày vào Đảng.',
    'Cột Khoa / Bộ môn / Khóa học / Lớp: có thể bỏ trống nếu đã chọn lớp trên UI — hệ thống tự lấy.',
    'Email SV sai đuôi (vd nhầm @student.ctut.edu.vn) sẽ bị từ chối.',
    'Mã SV và mã hồ sơ tự sinh. Import lại cùng email sẽ cập nhật hồ sơ cũ.',
    'Cần đã có lớp trước khi import sinh viên.',
    'Sau import, hệ thống đồng bộ tài khoản Người dùng (email, SĐT, lớp…).',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-sinh-vien.xlsx'), path.join(docsDir, '05_SinhVien.xlsx'));

// ── Quyền ──
writeTemplate(
  'mau-quyen.xlsx',
  'Quyen',
  ['Tên quyền', 'Nhóm', 'Mô tả'],
  [
    'Bắt buộc. Tên hiển thị quyền, có dấu. Vd: Trưởng khoa',
    'Bắt buộc. Một trong: Ban giám hiệu, Khoa, Bộ môn, Phòng, Trung tâm, Giảng dạy, Hành chính, Hệ thống',
    'Không bắt buộc. Mô tả ngắn về quyền',
  ],
  ['Trưởng khoa', 'Khoa', 'Khoa — Trưởng khoa'],
  [
    ...commonNotes,
    'File dùng cho trang Quản lý Quyền.',
    'Mã quyền tự sinh viết tắt từ tên (vd: Trưởng khoa → TK).',
    'Nhóm nhận tên tiếng Việt như trên; import lại cùng tên sẽ cập nhật quyền cũ.',
  ],
);
fs.copyFileSync(path.join(publicDir, 'mau-quyen.xlsx'), path.join(docsDir, '06_Quyen.xlsx'));

fs.writeFileSync(
  path.join(docsDir, '00_HUONG_DAN_IMPORT.txt'),
  `THỨ TỰ IMPORT (bắt buộc):
1) 01_Khoa.xlsx / mau-khoa.xlsx
2) 02_BoMon.xlsx / mau-bo-mon.xlsx
3) 03_GiangVien.xlsx / mau-giang-vien.xlsx
4) 04_Lop.xlsx / mau-lop.xlsx
5) 05_SinhVien.xlsx / mau-sinh-vien.xlsx
6) 06_Quyen.xlsx / mau-quyen.xlsx (có thể import độc lập)

CẤU TRÚC MỖI FILE MẪU:
- Dòng 1: tiêu đề cột (giữ nguyên)
- Dòng 2: hướng dẫn từng cột, bắt đầu bằng [HD] — hệ thống bỏ qua khi import
- Dòng 3+: dữ liệu (có sẵn 1 dòng mẫu để tham khảo)

Lưu ý:
- Không cần điền mã — hệ thống tự sinh mã và khớp theo TÊN khoa/bộ môn/lớp/GV/quyền.
- Nếu đã chọn khoa/bộ môn/lớp trên giao diện trước khi import, có thể bỏ trống cột tên tương ứng.
- File Excel cũ nếu vẫn có cột mã thì hệ thống vẫn nhận.
- Nhóm quyền: Ban giám hiệu, Khoa, Bộ môn, Phòng, Trung tâm, Giảng dạy, Hành chính, Hệ thống.
- Niên khóa / Năm học: 4 chữ số (vd 2024).
- Email SV: @student.ctuet.edu.vn
- Email GV/cán bộ: email thường (không dùng email sinh viên).
`,
  'utf8',
);

console.log('Done generating Excel import templates.');
