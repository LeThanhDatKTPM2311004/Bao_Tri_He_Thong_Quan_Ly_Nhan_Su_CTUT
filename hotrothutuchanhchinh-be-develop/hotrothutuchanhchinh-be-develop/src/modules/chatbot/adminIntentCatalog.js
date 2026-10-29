/**
 * Intent catalog — chatbot thư ký admin (rule/keyword, không LLM).
 */
export const ADMIN_INTENT_CATALOG = [
  {
    id: 'org_leadership',
    score: 16,
    patterns: [
      /hieu truong/,
      /pho hieu/,
      /ban giam hieu/,
      /truong khoa/,
      /pho truong khoa/,
      /truong bo mon/,
      /pho truong bo mon/,
      /lanh dao (khoa|bo mon|truong)/,
      /chu nhiem khoa/,
      /ai la (hieu truong|truong khoa|pho truong)/,
      /(hieu truong|truong khoa|truong bo mon).*(ten|la ai|ai)/,
      /(ten|la ai).*(hieu truong|truong khoa|truong bo mon)/,
    ],
  },
  {
    id: 'dashboard_stats',
    score: 12,
    patterns: [
      /thong ke/,
      /tong quan/,
      /dashboard/,
      /bao cao nhanh/,
      /hom nay/,
      /so lieu/,
      /tong so (ho so|don|user)/,
    ],
  },
  {
    id: 'account_me',
    score: 16,
    patterns: [
      /tai khoan (cua )?toi/,
      /profile (cua )?toi/,
      /toi la ai/,
      /thong tin (cua )?toi/,
      /thong tin admin/,
    ],
  },
  {
    id: 'users_search',
    score: 13,
    patterns: [
      /tim (user|nguoi dung|tai khoan)/,
      /danh sach (user|nguoi dung|tai khoan)/,
      /user nao/,
      /nguoi dung nao/,
      /email .+@/,
      /vai tro/,
      /role /,
    ],
  },
  {
    id: 'org_sinh_vien',
    score: 14,
    patterns: [
      /sinh vien/,
      /mssv/,
      /ma sv/,
      /tim sv/,
      /hoc sinh/,
    ],
  },
  {
    id: 'org_giang_vien',
    score: 13,
    patterns: [/giang vien/, /ma gv/, /tim gv/, /can bo giang day/],
  },
  {
    id: 'org_lop',
    score: 12,
    patterns: [/lop (nao|nao|hoc)/, /danh sach lop/, /ma lop/, /tim lop/, /co van lop/],
  },
  {
    id: 'org_khoa',
    score: 12,
    patterns: [/khoa (nao|nao)/, /danh sach khoa/, /ma khoa/, /tim khoa/],
  },
  {
    id: 'org_bomon',
    score: 12,
    patterns: [/bo mon/, /danh sach bo mon/, /ma bo mon/, /tim bo mon/],
  },
  {
    id: 'org_quyen',
    score: 11,
    patterns: [/quyen (nao|giang vien)/, /phan quyen/, /danh sach quyen/, /giang vien quyen/],
  },
  {
    id: 'workflow_steps',
    score: 16,
    patterns: [
      /buoc (quy trinh|cua don|duyet)/,
      /cac buoc/,
      /quy trinh (cua |don |cho )/,
      /quy trinh.*(bao luu|thoi hoc|hoc lai|the|thuc tap|hoan canh)/,
      /(bao luu|thoi hoc|hoc lai|cap lai the|thuc tap|hoan canh).*quy trinh/,
      /don .* (co may buoc|gom may buoc|qua may buoc)/,
      /ai duyet don/,
      /luong (duyet|xu ly) don/,
      /workflow (cua |don )/,
    ],
  },
  {
    id: 'forms_list',
    score: 13,
    patterns: [
      /loai don/,
      /mau (don|word)/,
      /bieu mau/,
      /don dang mo/,
      /co bao nhieu don/,
      /danh sach (don|thu tuc|bieu mau)/,
      /import forms?/,
    ],
  },
  {
    id: 'workflows_pending',
    score: 13,
    patterns: [
      /cho duyet/,
      /ho so cho/,
      /ho so dang/,
      /tre han/,
      /qua han/,
      /dang xu ly/,
      /ho so (pending|overdue)/,
    ],
  },
  {
    id: 'reports_summary',
    score: 11,
    patterns: [/bao cao/, /hieu suat/, /performance/, /thong ke quy trinh/],
  },
  {
    id: 'notifications',
    score: 10,
    patterns: [/thong bao/, /chua doc/, /notification/],
  },
  {
    id: 'settings_overview',
    score: 10,
    patterns: [/cai dat/, /he thong/, /tich hop/, /cloudinary/, /email server/, /trang thai he thong/],
  },
  {
    id: 'navigate_help',
    score: 12,
    patterns: [
      /mo (trang|quan ly|muc)/,
      /vao trang/,
      /dieu huong/,
      /lam sao de (vao|mo)/,
      /o dau/,
    ],
  },
  {
    id: 'how_to_import',
    score: 11,
    patterns: [/import excel/, /nhap excel/, /mau excel/, /import (khoa|lop|sinh vien|giang vien)/],
  },
  {
    id: 'how_to_workflow',
    score: 11,
    patterns: [/gan workflow/, /cau hinh quy trinh/, /tao quy trinh/, /gan loai don/],
  },
  {
    id: 'how_to_users',
    score: 10,
    patterns: [/tao user/, /them nguoi dung/, /khoa tai khoan/, /dat co van/],
  },
];

export const ADMIN_HOW_TO = {
  how_to_import: {
    answer: [
      '**Import Excel tổ chức**',
      '1. Vào đúng trang: Khoa & Bộ môn / Lớp & SV / Giảng viên / Quyền.',
      '2. Tải mẫu Excel trên trang (nút mẫu).',
      '3. Điền đúng cột → Import Excel.',
      '4. Xem kết quả dòng OK / lỗi trên phản hồi hệ thống.',
      '',
      'Bot không tự import giúp — hãy mở trang tương ứng để thao tác.',
    ].join('\n'),
    path: '/organization/khoa-bo-mon',
    label: 'Mở Khoa & Bộ môn',
  },
  how_to_workflow: {
    answer: [
      '**Gắn / cấu hình quy trình cho loại đơn**',
      '1. Import mẫu Word tại **Mẫu Word gốc** (`/forms`).',
      '2. Vào **Quản lý quy trình** → cấu hình bước (vai trò, hạn xử lý).',
      '3. Gắn `loaiDonId` / chọn loại đơn tương ứng.',
      '4. Kiểm tra hồ sơ thử trên cổng SV.',
      '',
      'Bot chỉ hướng dẫn; thao tác lưu workflow thực hiện trên trang quy trình.',
    ].join('\n'),
    path: '/workflows/pending',
    label: 'Mở Quản lý quy trình',
  },
  how_to_users: {
    answer: [
      '**Quản lý người dùng**',
      '• Tạo / sửa / khóa tài khoản: trang **Quản lý người dùng**.',
      '• Gán cố vấn lớp: tổ chức Lớp (coVan) hoặc chức năng gán CVHT trên Users nếu có.',
      '• Phân quyền giảng viên: trang **Quản lý quyền**.',
      '',
      'Bot có thể **tìm và xem chi tiết** tài khoản; không tạo/xóa từ chat.',
    ].join('\n'),
    path: '/users',
    label: 'Mở Quản lý người dùng',
  },
};

export const ADMIN_NAV_MAP = [
  { keys: ['dashboard', 'tong quan', 'thong ke'], path: '/dashboard', label: 'Tổng quan' },
  { keys: ['user', 'nguoi dung', 'tai khoan'], path: '/users', label: 'Quản lý người dùng' },
  { keys: ['khoa', 'bo mon'], path: '/organization/khoa-bo-mon', label: 'Khoa & Bộ môn' },
  { keys: ['lop', 'sinh vien', 'sv'], path: '/organization/lop-sinh-vien', label: 'Lớp & Sinh viên' },
  { keys: ['giang vien', 'gv'], path: '/organization/giang-vien', label: 'Giảng viên' },
  { keys: ['quyen'], path: '/organization/quyen', label: 'Quản lý quyền' },
  { keys: ['forms', 'mau', 'word', 'bieu mau', 'loai don'], path: '/forms', label: 'Mẫu Word gốc' },
  { keys: ['workflow', 'quy trinh', 'duyet', 'pending'], path: '/workflows/pending', label: 'Quản lý quy trình' },
  { keys: ['thong bao', 'notification'], path: '/notifications', label: 'Thông báo' },
  { keys: ['bao cao', 'report'], path: '/reports', label: 'Báo cáo & Thống kê' },
  { keys: ['account', 'tai khoan toi', 'chu ky'], path: '/account', label: 'Tài khoản' },
];

export const getAdminSuggestions = () => [
  'Hiệu trưởng tên gì?',
  'Trưởng khoa CNTT là ai?',
  'Các bước quy trình đơn thôi học',
  'Thống kê tổng quan hệ thống',
  'Có bao nhiêu đơn đang mở?',
  'Hồ sơ đang chờ duyệt',
  'Tìm sinh viên theo MSSV',
];
