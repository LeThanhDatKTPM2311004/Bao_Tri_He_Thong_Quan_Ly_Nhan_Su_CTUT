import { NEED_KEYWORDS_FROM_KB } from './procedureKnowledge.js';

/**
 * Catalog intent chatbot cổng sinh viên — rule/keyword, không LLM.
 * score: trọng số khi khớp pattern.
 */
export const INTENT_CATALOG = [
  {
    id: 'compare_procedures',
    label: 'So sánh thủ tục',
    score: 14,
    patterns: [
      /khac nhau/,
      /khac gi (giua|voi)/,
      /hay (bao luu|thoi hoc|hoc lai)/,
      /nen (bao luu|thoi hoc)/,
      /bao luu.*(hay|hoac|va|khac).*thoi/,
      /thoi hoc.*(hay|hoac|va|khac).*bao/,
      /so sanh/,
    ],
  },
  {
    id: 'workflow_steps',
    label: 'Các bước quy trình của đơn',
    score: 15,
    patterns: [
      /buoc (quy trinh|cua don|duyet)/,
      /cac buoc/,
      /quy trinh (cua |don |cho )/,
      /quy trinh.*(bao luu|thoi hoc|hoc lai|the|thuc tap|hoan canh)/,
      /(bao luu|thoi hoc|hoc lai|cap lai the|thuc tap|hoan canh).*quy trinh/,
      /don .* (co may buoc|gom may buoc|qua may buoc)/,
      /ai duyet don/,
      /luong (duyet|xu ly) don/,
    ],
  },
  {
    id: 'explain_procedure',
    label: 'Giải thích một thủ tục',
    score: 13,
    patterns: [
      /don (bao luu|thoi hoc|hoc lai|cap lai)/,
      /giay (xac nhan|gioi thieu)/,
      /(bao luu|thoi hoc|hoc lai|cap lai the|hoan canh|thuc tap).*(la gi|dung (de|khi)|muc dich|can gi)/,
      /(la gi|dung (de|khi nao)|muc dich|ai (duyet|ky)|can (nhung )?giay).*(bao luu|thoi hoc|hoc lai|the sinh vien|hoan canh|thuc tap|gioi thieu)/,
      /don (nay |do )?(la gi|dung|nop)/,
      /huong dan.*(bao luu|thoi hoc|hoc lai|the|thuc tap|hoan canh)/,
    ],
  },
  {
    id: 'recommend_procedure',
    label: 'Gợi ý đơn phù hợp',
    score: 12,
    patterns: [
      /don nao/,
      /thu tuc nao/,
      /lam don/,
      /nop don nao/,
      /phu hop/,
      /nen lam/,
      /muon (xin |duoc )?/,
      /toi muon/,
      /em muon/,
      /can lam gi/,
      /thu tuc nao phu hop/,
      /goi y.*don/,
    ],
  },
  {
    id: 'org_leadership',
    label: 'Lãnh đạo trường / khoa / bộ môn',
    score: 14,
    patterns: [
      /hieu truong/,
      /pho hieu/,
      /ban giam hieu/,
      /truong khoa/,
      /pho truong khoa/,
      /truong bo mon/,
      /pho truong bo mon/,
      /lanh dao (khoa|bo mon)/,
      /ai la (hieu truong|truong khoa)/,
      /(hieu truong|truong khoa).*(ten|la ai)/,
      /(ten|la ai).*(hieu truong|truong khoa)/,
    ],
  },
  {
    id: 'my_advisor',
    label: 'Cố vấn lớp của tôi',
    score: 12,
    requiresAuth: true,
    patterns: [
      /co van/,
      /cvht/,
      /co van (lop|hoc tap)/,
      /co van (cua )?toi/,
      /lop (cua )?toi.*co van/,
      /ai (la )?co van/,
    ],
  },
  {
    id: 'my_faculty_dean',
    label: 'Trưởng khoa của tôi',
    score: 12,
    requiresAuth: true,
    patterns: [
      /truong khoa/,
      /pho truong khoa/,
      /ban chu nhiem khoa/,
      /lanh dao khoa/,
      /ai (la )?truong khoa/,
      /khoa (cua )?toi.*(truong|lanh dao)/,
    ],
  },
  {
    id: 'my_department_chair',
    label: 'Trưởng bộ môn của tôi',
    score: 12,
    requiresAuth: true,
    patterns: [
      /truong bo mon/,
      /pho truong bo mon/,
      /bo mon (cua )?toi/,
      /ai (la )?truong bo mon/,
      /lanh dao bo mon/,
    ],
  },
  {
    id: 'my_org_contacts',
    label: 'Cán bộ liên quan đến tôi',
    score: 11,
    requiresAuth: true,
    patterns: [
      /can bo (lop|khoa|bo mon)/,
      /ai quan ly (lop|khoa)/,
      /lien he (ai|can bo|co van|khoa)/,
      /thong tin can bo/,
      /lanh dao (cua )?toi/,
    ],
  },
  {
    id: 'my_submissions',
    label: 'Hồ sơ của tôi',
    score: 11,
    patterns: [
      /ho so (cua )?toi/,
      /don (cua )?toi/,
      /don dang/,
      /trang thai (don|ho so)/,
      /dang o buoc/,
      /dang cho duyet/,
      /tien do/,
      /ho so nao/,
    ],
    requiresAuth: true,
  },
  {
    id: 'how_to_withdraw',
    label: 'Rút đơn',
    score: 10,
    patterns: [/rut don/, /huy don/, /rut ho so/, /muon rut/, /co rut (duoc|lai)/],
  },
  {
    id: 'how_to_submit',
    label: 'Cách nộp đơn',
    score: 9,
    patterns: [/nop don/, /cach nop/, /lam the nao de nop/, /huong dan nop/, /dien form/],
  },
  {
    id: 'processing_time',
    label: 'Thời gian xử lý',
    score: 8,
    patterns: [/bao lau/, /may ngay/, /thoi gian (xu ly|duyet)/, /xu ly mat/],
  },
  {
    id: 'download_result',
    label: 'Tải kết quả đã ký',
    score: 8,
    patterns: [/tai (ket qua|file|pdf|ho so)/, /ban da ky/, /chu ky so.*tai/, /in quyet dinh/],
  },
  {
    id: 'parent_signature',
    label: 'Chữ ký phụ huynh',
    score: 8,
    patterns: [/phu huynh/, /chu ky (cua )?phu huynh/, /tai sao.*phu huynh/],
  },
  {
    id: 'digital_signature',
    label: 'Chữ ký số',
    score: 7,
    patterns: [/chu ky so/, /gia tri phap ly/, /ky so/, /chung thu so/],
  },
  {
    id: 'login_help',
    label: 'Đăng nhập',
    score: 7,
    patterns: [/dang nhap/, /email (ca nhan|sinh vien)/, /tai khoan/, /google/],
  },
  {
    id: 'forgot_password',
    label: 'Quên mật khẩu',
    score: 8,
    patterns: [/quen mat khau/, /khong dang nhap (duoc|duoc)/, /mat khau/],
  },
  {
    id: 'list_procedures',
    label: 'Danh sách thủ tục',
    score: 15,
    patterns: [
      /danh sach (don|thu tuc)/,
      /co nhung (don|thu tuc)/,
      /nhung (don|thu tuc) nao/,
      /cac loai don/,
      /thu tuc nao co/,
      /he thong co (nhung )?don/,
      /co (may|nhung) thu tuc/,
    ],
  },
  {
    id: 'status_meaning',
    label: 'Ý nghĩa trạng thái',
    score: 6,
    patterns: [/trang thai/, /da rut/, /da phe duyet/, /bi tu choi/, /tre han/, /cho duyet/, /dang xu ly/],
  },
  {
    id: 'navigate_my_forms',
    label: 'Mở hồ sơ của tôi',
    score: 6,
    patterns: [/mo ho so/, /vao ho so cua toi/, /xem ho so da nop/],
  },
];

/** Từ khóa nhu cầu → ưu tiên khớp tên đơn (đồng bộ 6 thủ tục trong procedureKnowledge) */
export const NEED_KEYWORDS = NEED_KEYWORDS_FROM_KB;

export const FAQ_ENTRIES = [
  {
    intent: 'login_help',
    answer:
      'Bạn cần đăng nhập bằng email sinh viên do nhà trường cấp (thường dạng @student.ctuet.edu.vn hoặc tài khoản tương đương trên cổng). Email cá nhân (Gmail thường) không dùng để đăng nhập cổng dịch vụ công.',
    actions: [{ type: 'navigate', page: 'login', label: 'Đến trang đăng nhập' }],
  },
  {
    intent: 'forgot_password',
    answer:
      'Nếu quên mật khẩu email sinh viên / không đăng nhập được, vui lòng liên hệ Khoa Công nghệ thông tin để được hỗ trợ cấp lại. Trên cổng quản trị có chức năng quên mật khẩu cho tài khoản nội bộ; sinh viên thường lấy lại qua đơn vị quản lý tài khoản email trường.',
    actions: [{ type: 'navigate', page: 'login', label: 'Thử đăng nhập lại' }],
  },
  {
    intent: 'digital_signature',
    answer:
      'Chữ ký số trên biểu mẫu điện tử của hệ thống một cửa được thiết kế để có giá trị pháp lý tương đương chữ ký tay và con dấu trong quy trình phê duyệt nội bộ. Bạn có thể xem bản PDF đã ký sau khi hồ sơ hoàn tất.',
    actions: [{ type: 'navigate', page: 'search', label: 'Hồ sơ của tôi' }],
  },
  {
    intent: 'parent_signature',
    answer:
      'Trong 6 thủ tục trên cổng: **bảo lưu**, **thôi học**, **học lại (sau bảo lưu)** thường bắt buộc chữ ký phụ huynh vì liên quan học tịch. **Cấp lại thẻ**, **hoàn cảnh khó khăn**, **giấy giới thiệu thực tập** thường không bắt buộc chữ ký phụ huynh. Khi nộp, hệ thống sẽ hiện bước ký nếu mẫu có trường chữ ký phụ huynh.',
  },
  {
    intent: 'processing_time',
    answer:
      'Thông thường hồ sơ được xử lý khoảng 3 đến 5 ngày làm việc, tùy tiến độ CVHT, Khoa và các phòng ban. Bạn nên theo dõi trạng thái cụ thể tại trang Hồ sơ của tôi.',
    actions: [{ type: 'navigate', page: 'search', label: 'Xem hồ sơ của tôi' }],
  },
  {
    intent: 'how_to_withdraw',
    answer:
      'Khi đơn đang chờ xử lý / đang duyệt / trễ hạn / nháp (kể cả đã có chữ ký một phần), vào trang tiến độ hồ sơ → chọn Rút đơn → nhập lý do (bắt buộc). Hồ sơ sẽ dừng và không còn trong danh sách chờ của cán bộ. Muốn tiếp tục phải nộp đơn mới. Khi đã phê duyệt hoàn tất thì không rút được.',
    actions: [{ type: 'navigate', page: 'search', label: 'Mở hồ sơ để rút' }],
  },
  {
    intent: 'download_result',
    answer:
      'Khi hồ sơ ở trạng thái Đã phê duyệt, vào chi tiết / tiến độ hồ sơ và chọn xem hoặc tải file PDF. Bản đã ký số (nếu có) nằm trong file đó — thường xem ở các trang cuối PDF.',
    actions: [{ type: 'navigate', page: 'search', label: 'Hồ sơ của tôi' }],
  },
  {
    intent: 'how_to_submit',
    answer:
      'Cách nộp: (1) Chọn thủ tục trên trang chủ, (2) Đăng nhập bằng email SV, (3) Điền form (một số trường tự điền từ hồ sơ), (4) Xem trước PDF, (5) Ký tay / ký phụ huynh nếu mẫu yêu cầu, (6) Nộp đơn. Sau khi nộp, theo dõi tại Hồ sơ của tôi.',
    actions: [{ type: 'navigate', page: 'home', label: 'Chọn thủ tục' }],
  },
  {
    intent: 'status_meaning',
    answer:
      'Một số trạng thái thường gặp: Chờ xử lý / Đang xử lý — đang trong quy trình duyệt; Đã trễ hạn — bước hiện tại quá hạn; Cần chỉnh sửa — bị trả về để SV sửa và nộp lại; Đã phê duyệt — hoàn tất; Bị từ chối — không được duyệt; Đã rút — SV đã rút đơn.',
    actions: [{ type: 'navigate', page: 'search', label: 'Xem hồ sơ của tôi' }],
  },
];
