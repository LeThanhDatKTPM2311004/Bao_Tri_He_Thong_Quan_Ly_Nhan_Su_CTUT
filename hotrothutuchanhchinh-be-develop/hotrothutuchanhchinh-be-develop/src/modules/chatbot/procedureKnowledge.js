/**
 * Kiến thức nghiệp vụ 6 thủ tục đang mở trên hệ thống.
 * Dùng để chatbot giải đáp / gợi ý / so sánh — khớp theo tên LoaiDon trong DB.
 */

const strip = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mỗi mục: matchName khớp tenDon DB; needKeys bắt nhu cầu SV; faqs trả lời tình huống.
 */
export const PROCEDURE_KB = [
  {
    id: 'bao_luu',
    matchName: ['bao luu', 'tam nghi'],
    displayName: 'Đơn bảo lưu (tạm nghỉ học)',
    purpose:
      'Xin tạm dừng học tập trong một thời gian (thường theo học kỳ), bảo lưu kết quả đã học — không rút hẳn học tịch.',
    useWhen: [
      'Cần nghỉ học tạm thời vì lý do cá nhân, sức khỏe, hoàn cảnh gia đình… rồi quay lại học tiếp',
      'Muốn giữ kết quả / tiến độ đã đạt, không muốn thôi học hẳn',
    ],
    notWhen: [
      'Không muốn học nữa / rút hẳn khỏi trường → dùng Đơn xin thôi học',
      'Hết thời gian bảo lưu, muốn vào lại lớp → dùng Đơn học lại',
    ],
    needParentSignature: true,
    whoApproves: ['Sinh viên nộp', 'Phụ huynh ký', 'CVHT', 'Ban chủ nhiệm Khoa', 'Phòng CTCT-SV-KN (trình quyết định)'],
    result: 'Quyết định bảo lưu / tạm nghỉ học (theo quy trình duyệt).',
    notes: [
      'Bắt buộc chữ ký phụ huynh vì ảnh hưởng học tịch.',
      'Thời gian xử lý tham khảo khoảng 3–5 ngày làm việc tùy tiến độ các bước.',
    ],
    needKeys: [
      'bao luu',
      'tam nghi',
      'nghi hoc tam thoi',
      'tam dung hoc',
      'ngung hoc mot thoi gian',
      'tam nghi hoc',
      'nghi mot hoc ky',
      'dung hoc tam',
      'bao luu ket qua',
    ],
    boost: ['bao luu', 'tam nghi'],
    hint: 'bảo lưu / tạm nghỉ học',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer:
          'Đơn bảo lưu dùng khi bạn muốn tạm dừng học một thời gian nhưng vẫn giữ học tịch và kết quả đã học, rồi quay lại sau. Không dùng khi muốn rút hẳn khỏi trường.',
      },
      {
        keys: ['phu huynh', 'chu ky phu huynh'],
        answer:
          'Có — đơn bảo lưu / tạm nghỉ thường bắt buộc chữ ký xác nhận của phụ huynh theo quy chế.',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'buoc', 'ai ky', 'cvht'],
        answer:
          'Quy trình tham khảo: SV nộp → Phụ huynh ký → CVHT → Khoa → Phòng CTCT-SV-KN (trình quyết định). Theo dõi trạng thái tại Hồ sơ của tôi.',
      },
      {
        keys: ['bao lau', 'may ngay', 'thoi gian'],
        answer:
          'Thường khoảng 3–5 ngày làm việc tùy tiến độ CVHT/Khoa/phòng ban. Xem tiến độ cụ thể trên hồ sơ đã nộp.',
      },
      {
        keys: ['khac thoi hoc', 'hay thoi hoc', 'nen bao luu'],
        answer:
          'Bảo lưu = nghỉ tạm, còn quay lại. Thôi học = rút hẳn học tịch. Nếu còn dự định học tiếp thì chọn bảo lưu.',
      },
    ],
  },
  {
    id: 'hoc_lai',
    matchName: ['hoc lai'],
    displayName: 'Đơn học lại',
    purpose:
      'Dùng khi hết thời gian bảo lưu / tạm nghỉ, muốn trở lại trường tiếp tục học (cập nhật lại trạng thái đang học, phân lớp).',
    useWhen: [
      'Đã có quyết định tạm nghỉ / bảo lưu trước đó và hết thời hạn nghỉ',
      'Muốn vào lại lớp, tiếp tục chương trình đào tạo',
    ],
    notWhen: [
      'Chưa nghỉ / chưa bảo lưu mà muốn tạm dừng → Đơn bảo lưu',
      'Muốn rút hẳn → Đơn thôi học',
      'Chỉ muốn học lại một môn do thi rớt: đây là quy trình học vụ khác; trên cổng hiện có mẫu đơn học lại gắn với quay lại sau bảo lưu — nên hỏi CVHT nếu bạn cần học lại môn',
    ],
    needParentSignature: true,
    whoApproves: ['Sinh viên nộp', 'Phụ huynh ký', 'CVHT nhận lại lớp', 'Khoa', 'Phòng CTCT-SV-KN'],
    result: 'Cập nhật trạng thái đang học / phân lớp theo quyết định tiếp nhận.',
    notes: [
      'Thường cần thông tin quyết định tạm nghỉ trước đó (số quyết định, ngày ký) khi điền đơn.',
      'Nếu câu hỏi của bạn là thi rớt muốn học lại môn, hãy xác nhận với CVHT vì có thể không dùng mẫu này.',
    ],
    needKeys: [
      'hoc lai',
      'tro lai hoc',
      'quay lai hoc',
      'het bao luu',
      'het tam nghi',
      'vao lai lop',
      'hoc lai sau tam nghi',
      'hoc lai sau bao luu',
    ],
    boost: ['hoc lai'],
    hint: 'học lại (sau bảo lưu / tạm nghỉ)',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer:
          'Đơn học lại trên cổng dùng khi bạn đã bảo lưu/tạm nghỉ và muốn trở lại học. Không phải mẫu mặc định cho việc học lại từng môn do điểm kém — trường hợp đó hỏi CVHT.',
      },
      {
        keys: ['thi rot', 'hoc lai mon', 'diem kem'],
        answer:
          'Mẫu đơn học lại trên hệ thống gắn với quay lại sau bảo lưu. Việc đăng ký học lại môn do thi rớt thường thuộc quy trình học vụ riêng — bạn nên hỏi CVHT/Khoa trước khi nộp mẫu này.',
      },
      {
        keys: ['phu huynh', 'chu ky phu huynh'],
        answer: 'Thường có bước phụ huynh ký xác nhận trên quy trình hướng dẫn của thủ tục này.',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'buoc', 'ai ky'],
        answer:
          'Tham khảo: SV nộp (kèm thông tin QĐ tạm nghỉ) → Phụ huynh → CVHT → Khoa → P.CTCT-SV-KN cập nhật trạng thái đang học.',
      },
      {
        keys: ['can gi', 'ho so', 'giay to', 'quyet dinh'],
        answer:
          'Chuẩn bị thông tin quyết định tạm nghỉ/bảo lưu trước đó (số QĐ, ngày ký) và điền đầy đủ form trên cổng trước khi nộp.',
      },
    ],
  },
  {
    id: 'thoi_hoc',
    matchName: ['thoi hoc'],
    displayName: 'Đơn xin thôi học',
    purpose: 'Xin rút hẳn học tịch tại trường (tự nguyện thôi học) — không còn là sinh viên đang theo học.',
    useWhen: [
      'Không tiếp tục học tại trường nữa',
      'Muốn rút tên / kết thúc quan hệ đào tạo với nhà trường',
    ],
    notWhen: [
      'Chỉ nghỉ tạm rồi học tiếp → Đơn bảo lưu',
      'Hết bảo lưu muốn vào lại → Đơn học lại',
    ],
    needParentSignature: true,
    whoApproves: ['Sinh viên nộp', 'Phụ huynh bắt buộc ký', 'CVHT', 'Khoa', 'Phòng CTCT-SV-KN (trình quyết định thôi học)'],
    result: 'Quyết định thôi học / hoàn tất thủ tục xóa tên theo quy trình.',
    notes: [
      'Chữ ký phụ huynh là quy định cốt lõi với thôi học.',
      'Sau khi đã phê duyệt hoàn tất thường không rút đơn được — cân nhắc kỹ trước khi nộp.',
    ],
    needKeys: [
      'thoi hoc',
      'xin thoi hoc',
      'khong hoc nua',
      'rut hoc tich',
      'bo hoc',
      'ngung hoc han',
      'chuyen truong',
      'rut ten',
    ],
    boost: ['thoi hoc'],
    hint: 'thôi học',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer:
          'Đơn thôi học dùng khi bạn tự nguyện rút hẳn khỏi trường. Nếu chỉ nghỉ tạm rồi học lại, hãy dùng đơn bảo lưu.',
      },
      {
        keys: ['phu huynh', 'chu ky phu huynh'],
        answer: 'Có — thôi học bắt buộc phụ huynh ký đồng ý theo quy chế.',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'buoc', 'ai ky'],
        answer:
          'Tham khảo: SV nộp → Phụ huynh → CVHT (gặp/xác nhận) → Khoa → P.CTCT-SV-KN thẩm định, trình quyết định.',
      },
      {
        keys: ['co rut', 'doi y', 'huy'],
        answer:
          'Khi đơn còn đang xử lý bạn có thể Rút đơn trên cổng (nhập lý do). Đã phê duyệt hoàn tất thì không rút được.',
      },
      {
        keys: ['khac bao luu', 'hay bao luu', 'nen thoi'],
        answer:
          'Thôi học = rút hẳn. Bảo lưu = nghỉ tạm, còn học tịch. Chỉ chọn thôi học khi chắc không học tiếp tại trường.',
      },
    ],
  },
  {
    id: 'cap_the',
    matchName: ['cap lai the', 'the sinh vien', 'the sv'],
    displayName: 'Đơn cấp lại thẻ sinh viên',
    purpose: 'Xin cấp lại thẻ sinh viên (thẻ tích hợp) khi bị mất, hỏng hoặc cần làm lại.',
    useWhen: [
      'Mất thẻ sinh viên',
      'Thẻ hỏng / không dùng được',
      'Cần cấp lại thẻ tích hợp',
    ],
    notWhen: ['Không liên quan bảo lưu / thôi học / thực tập'],
    needParentSignature: false,
    whoApproves: ['Sinh viên nộp', 'CVHT xác nhận đang học', 'Phòng CTCT & QLSV', 'Ban Giám hiệu', 'Ngân hàng phát hành thẻ (theo quy trình nhà trường)'],
    result: 'Phê duyệt cấp lại thẻ; nhận thẻ theo hướng dẫn đơn vị phát hành.',
    notes: [
      'Khi điền đơn thường cần thông tin liên quan thẻ / tài khoản ngân hàng liên kết (nếu mẫu yêu cầu).',
      'Không bắt buộc chữ ký phụ huynh như các đơn ảnh hưởng học tịch.',
    ],
    needKeys: [
      'cap lai the',
      'mat the',
      'mat the sv',
      'the sinh vien',
      'lam lai the',
      'the hong',
      'the bi mat',
      'cap the',
      'lam the moi',
    ],
    boost: ['the sinh vien', 'cap lai', 'the sv'],
    hint: 'cấp lại thẻ sinh viên',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer: 'Dùng khi mất hoặc hỏng thẻ sinh viên và cần nhà trường / đơn vị liên quan cấp lại thẻ.',
      },
      {
        keys: ['phu huynh'],
        answer: 'Thủ tục cấp lại thẻ thường không yêu cầu chữ ký phụ huynh (khác với thôi học/bảo lưu).',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'buoc'],
        answer:
          'Tham khảo: SV nộp → CVHT → Phòng CTCT & QLSV → BGH → đơn vị phát hành thẻ (ví dụ ngân hàng liên kết). Theo dõi trên Hồ sơ của tôi.',
      },
      {
        keys: ['can gi', 'ho so', 'tai khoan', 'ngan hang'],
        answer:
          'Điền đủ form trên cổng; nếu mẫu có trường số tài khoản ngân hàng liên kết thẻ thì ghi chính xác. Mang CCCD khi nhận thẻ theo hướng dẫn sau khi duyệt.',
      },
      {
        keys: ['bao lau', 'may ngay'],
        answer:
          'Thời gian tùy tiến độ duyệt nội bộ và phát hành thẻ cứng; theo dõi trạng thái hồ sơ trên cổng.',
      },
    ],
  },
  {
    id: 'hoan_canh',
    matchName: ['hoan canh', 'kho khan'],
    displayName: 'Giấy xác nhận hoàn cảnh khó khăn',
    purpose:
      'Xin giấy xác nhận hoàn cảnh khó khăn để làm hồ sơ miễn giảm học phí, học bổng, trợ cấp hoặc chế độ liên quan.',
    useWhen: [
      'Cần xác nhận HCKK cho miễn giảm học phí / học bổng / trợ cấp',
      'Đơn vị yêu cầu giấy xác nhận hoàn cảnh của trường / quy trình một cửa',
    ],
    notWhen: ['Không dùng thay đơn bảo lưu, thôi học hay cấp thẻ'],
    needParentSignature: false,
    whoApproves: [
      'Sinh viên khai báo',
      'UBND / địa phương thường trú xác nhận (theo hướng dẫn mẫu)',
      'CVHT / Khoa ghi nhận',
      'Phòng CTCT-SV-KN xử lý chế độ',
    ],
    result: 'Giấy / xác nhận hoàn cảnh khó khăn phục vụ chế độ sinh viên.',
    notes: [
      'Có bước xác nhận của địa phương (UBND) ngoài luồng ký nội bộ trường — chuẩn bị giấy tờ địa phương theo hướng dẫn.',
      'Nêu rõ mục đích dùng giấy (miễn giảm, học bổng…) khi được hỏi trên form.',
    ],
    needKeys: [
      'hoan canh',
      'kho khan',
      'xac nhan hoan canh',
      'hckk',
      'mien giam',
      'hoc bong',
      'tro cap',
      'ho ngheo',
      'can ngheo',
      'che do',
    ],
    boost: ['hoan canh', 'kho khan'],
    hint: 'xác nhận hoàn cảnh khó khăn',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer:
          'Giấy xác nhận hoàn cảnh khó khăn dùng để làm căn cứ miễn giảm học phí, học bổng hoặc trợ cấp xã hội theo quy định.',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'ubnd', 'dia phuong', 'buoc'],
        answer:
          'Thường gồm: SV khai trên cổng → địa phương/UBND xác nhận hoàn cảnh → CVHT/Khoa ghi nhận → P.CTCT-SV-KN xử lý chế độ. Kiểm tra mẫu để biết bước nào làm online / mang giấy.',
      },
      {
        keys: ['can gi', 'ho so', 'giay to'],
        answer:
          'Chuẩn bị thông tin cá nhân, tóm tắt hoàn cảnh, và giấy xác nhận địa phương nếu quy trình yêu cầu đóng dấu UBND nơi thường trú.',
      },
      {
        keys: ['phu huynh'],
        answer:
          'Thủ tục này trọng tâm là xác nhận hoàn cảnh (địa phương + nhà trường), không giống bắt buộc chữ ký phụ huynh như thôi học/bảo lưu.',
      },
    ],
  },
  {
    id: 'thuc_tap',
    matchName: ['gioi thieu', 'thuc tap'],
    displayName: 'Giấy giới thiệu thực tập',
    purpose: 'Giới thiệu sinh viên đến cơ quan / doanh nghiệp để thực tập (thường là thực tập tốt nghiệp).',
    useWhen: [
      'Cần giấy giới thiệu mang tới đơn vị thực tập',
      'Doanh nghiệp yêu cầu giấy giới thiệu có xác nhận của Khoa / nhà trường',
    ],
    notWhen: ['Không dùng cho bảo lưu, thôi học, cấp thẻ, HCKK'],
    needParentSignature: false,
    whoApproves: ['SV cung cấp thông tin đơn vị thực tập', 'Khoa / lãnh đạo Khoa ký ban hành giấy giới thiệu', 'Doanh nghiệp tiếp nhận (ngoài hệ thống)'],
    result: 'Giấy giới thiệu thực tập (PDF đã ký) để mang tới đơn vị.',
    notes: [
      'Cần điền đúng tên đơn vị thực tập, thời gian thực tập trên form.',
      'Sau khi có giấy đã ký, mang tới doanh nghiệp để đơn vị ký tiếp nhận (bước ngoài cổng).',
    ],
    needKeys: [
      'gioi thieu',
      'thuc tap',
      'giay gioi thieu',
      'thuc tap tot nghiep',
      'don vi thuc tap',
      'cong ty thuc tap',
      'thuc tap doanh nghiep',
    ],
    boost: ['gioi thieu', 'thuc tap'],
    hint: 'giấy giới thiệu thực tập',
    faqs: [
      {
        keys: ['la gi', 'dung de', 'muc dich', 'de lam gi', 'khi nao dung'],
        answer:
          'Giấy giới thiệu thực tập dùng để nhà trường / Khoa giới thiệu bạn tới doanh nghiệp hoặc cơ quan tiếp nhận thực tập.',
      },
      {
        keys: ['ai duyet', 'quy trinh', 'ai ky', 'buoc'],
        answer:
          'Thường: điền thông tin (đơn vị, thời gian) → Khoa/lãnh đạo Khoa ký ban hành → bạn mang giấy tới doanh nghiệp để tiếp nhận. Theo dõi file đã ký trên hồ sơ.',
      },
      {
        keys: ['can gi', 'ho so', 'thong tin'],
        answer:
          'Cần tên đơn vị thực tập, ngành/lớp, thời gian bắt đầu–kết thúc thực tập (theo trường trên form). Điền đúng để giấy in ra không sai thông tin.',
      },
      {
        keys: ['phu huynh'],
        answer: 'Giấy giới thiệu thực tập thường không yêu cầu chữ ký phụ huynh.',
      },
      {
        keys: ['tai', 'pdf', 'ban ky'],
        answer:
          'Khi hồ sơ đã phê duyệt, vào Hồ sơ của tôi để xem/tải PDF giấy giới thiệu đã ký.',
      },
    ],
  },
];

/** So sánh cặp thủ tục dễ nhầm */
export const COMPARE_KB = [
  {
    id: 'bao_luu_vs_thoi_hoc',
    keys: [
      'bao luu.*thoi hoc',
      'thoi hoc.*bao luu',
      'bao luu hay thoi',
      'thoi hoc hay bao',
      'khac nhau.*bao luu',
      'khac nhau.*thoi hoc',
      'nen bao luu',
      'nen thoi hoc',
    ],
    answer: [
      '**Bảo lưu (tạm nghỉ):** nghỉ tạm, còn học tịch, sau có thể học lại.',
      '**Thôi học:** rút hẳn học tịch, không còn theo học tại trường.',
      'Nếu còn dự định quay lại học → chọn **Đơn bảo lưu**. Chỉ khi chắc không học tiếp → **Đơn xin thôi học**.',
      'Cả hai thường bắt buộc chữ ký phụ huynh.',
    ].join('\n'),
    procedureIds: ['bao_luu', 'thoi_hoc'],
  },
  {
    id: 'bao_luu_vs_hoc_lai',
    keys: [
      'bao luu.*hoc lai',
      'hoc lai.*bao luu',
      'tam nghi.*hoc lai',
      'het bao luu',
      'sau bao luu',
    ],
    answer: [
      '**Đơn bảo lưu:** xin tạm dừng học.',
      '**Đơn học lại:** dùng khi đã bảo lưu/tạm nghỉ xong và muốn trở lại lớp.',
      'Chưa nghỉ mà muốn nghỉ → bảo lưu. Đã nghỉ xong muốn vào lại → học lại.',
    ].join('\n'),
    procedureIds: ['bao_luu', 'hoc_lai'],
  },
  {
    id: 'hoc_lai_vs_thoi_hoc',
    keys: ['hoc lai.*thoi hoc', 'thoi hoc.*hoc lai'],
    answer:
      'Học lại = quay lại học sau bảo lưu. Thôi học = rút hẳn. Hai thủ tục ngược mục đích — chọn đúng nhu cầu trước khi nộp.',
    procedureIds: ['hoc_lai', 'thoi_hoc'],
  },
];

export const findKbByTenDon = (tenDon = '') => {
  const n = strip(tenDon);
  return PROCEDURE_KB.find((p) => p.matchName.some((m) => n.includes(strip(m)))) || null;
};

export const findKbByMessage = (normalizedMessage = '') => {
  const msg = strip(normalizedMessage);
  let best = null;
  let bestScore = 0;
  for (const p of PROCEDURE_KB) {
    let score = 0;
    for (const k of p.needKeys) {
      if (msg.includes(strip(k))) score += Math.max(3, strip(k).split(' ').length);
    }
    for (const m of p.matchName) {
      if (msg.includes(strip(m))) score += 8;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore > 0 ? best : null;
};

export const findCompare = (normalizedMessage = '') => {
  const msg = strip(normalizedMessage);
  for (const c of COMPARE_KB) {
    if (c.keys.some((k) => new RegExp(k).test(msg))) return c;
  }
  return null;
};

export const matchFaqInKb = (kb, normalizedMessage = '') => {
  if (!kb?.faqs?.length) return null;
  const msg = strip(normalizedMessage);
  let best = null;
  let bestHits = 0;
  for (const faq of kb.faqs) {
    const hits = (faq.keys || []).filter((k) => msg.includes(strip(k))).length;
    if (hits > bestHits) {
      bestHits = hits;
      best = faq;
    }
  }
  return bestHits > 0 ? best : null;
};

/** NEED_KEYWORDS tương thích recommendProcedures */
export const NEED_KEYWORDS_FROM_KB = PROCEDURE_KB.map((p) => ({
  keys: p.needKeys,
  boost: p.boost,
  hint: p.hint,
  procedureId: p.id,
}));


export const buildProcedureOverview = (kb) => {
  if (!kb) return '';
  const lines = [
    `**${kb.displayName}**`,
    '',
    `Mục đích: ${kb.purpose || 'Thủ tục đang mở trên cổng dịch vụ công.'}`,
  ];
  if (kb.useWhen?.length) {
    lines.push('', 'Nên dùng khi:', ...kb.useWhen.map((x) => `• ${x}`));
  }
  if (kb.notWhen?.length) {
    lines.push('', 'Không dùng khi:', ...kb.notWhen.map((x) => `• ${x}`));
  }
  if (typeof kb.needParentSignature === 'boolean') {
    lines.push(
      '',
      `Chữ ký phụ huynh: ${kb.needParentSignature ? 'Thường bắt buộc / có trên mẫu' : 'Thường không bắt buộc (theo mẫu hiện có)'}`,
    );
  }
  if (kb.whoApproves?.length) {
    lines.push('', 'Ai xử lý (theo hệ thống):', ...kb.whoApproves.map((x, i) => `${i + 1}. ${x}`));
  }
  if (kb.result) {
    lines.push('', `Kết quả: ${kb.result}`);
  }
  if (kb.notes?.length) {
    lines.push('', 'Lưu ý:', ...kb.notes.map((x) => `• ${x}`));
  }
  return lines.join('\n');
};

/** Entry runtime từ LoaiDon (+ merge KB tĩnh nếu khớp 6 đơn đã biết) */
export const loaiDonToRuntimeEntry = (form) => {
  const staticKb = findKbByTenDon(form.tenDon);
  const idx = form.chatbotIndex || {};
  const nameStrip = strip(form.tenDon || '');

  if (staticKb) {
    return {
      ...staticKb,
      loaiDonId: String(form._id),
      tenDon: form.tenDon,
      displayName: form.tenDon || staticKb.displayName,
      purpose: staticKb.purpose || idx.purposeSnippet || form.description || staticKb.purpose,
      needKeys: [...new Set([...(staticKb.needKeys || []), ...(idx.keywords || [])])],
      whoApproves:
        staticKb.whoApproves?.length > 0 ? staticKb.whoApproves : idx.whoApproves || [],
      needParentSignature:
        typeof idx.needParentSignature === 'boolean'
          ? staticKb.needParentSignature || idx.needParentSignature
          : staticKb.needParentSignature,
      fromStatic: true,
    };
  }

  const keywords =
    idx.keywords?.length > 0
      ? idx.keywords
      : nameStrip.split(' ').filter((t) => t.length >= 3);

  return {
    id: `ld_${form._id}`,
    loaiDonId: String(form._id),
    tenDon: form.tenDon,
    displayName: form.tenDon,
    matchName: [nameStrip],
    purpose:
      idx.purposeSnippet ||
      form.description ||
      `Thủ tục ${form.tenDon} đang mở trên cổng dịch vụ công.`,
    useWhen: [`Khi bạn cần thực hiện thủ tục ${form.tenDon} theo quy định nhà trường`],
    notWhen: ['Nếu nhu cầu khớp thủ tục khác trên danh sách, hãy chọn đúng mẫu tương ứng'],
    needParentSignature: !!idx.needParentSignature,
    whoApproves:
      idx.whoApproves?.length > 0
        ? idx.whoApproves
        : ['Theo quy trình đã cấu hình trên hệ thống (hiển thị khi nộp đơn)'],
    result:
      'Hồ sơ được xử lý theo quy trình gắn với thủ tục; xem/tải kết quả tại Hồ sơ của tôi khi hoàn tất.',
    notes: idx.fieldHints?.length
      ? [`Một số trường trên form: ${idx.fieldHints.slice(0, 8).join(', ')}`]
      : [],
    needKeys: keywords,
    boost: keywords.filter((k) => !k.includes(' ')).slice(0, 5),
    hint: form.tenDon,
    faqs: [
      {
        keys: ['la gi', 'muc dich', 'dung de', 'khi nao dung', 'de lam gi'],
        answer:
          idx.purposeSnippet ||
          form.description ||
          `Đây là thủ tục ${form.tenDon} trên cổng. Chọn nộp để điền form và gửi duyệt.`,
      },
      {
        keys: ['ai duyet', 'quy trinh', 'buoc', 'ai ky'],
        answer:
          idx.whoApproves?.length > 0
            ? `Các bước/vai trò trên hệ thống: ${idx.whoApproves.join(' → ')}.`
            : 'Quy trình duyệt theo cấu hình workflow của thủ tục; theo dõi tại Hồ sơ của tôi.',
      },
      {
        keys: ['can gi', 'ho so', 'giay to', 'truong'],
        answer:
          idx.fieldHints?.length > 0
            ? `Form có các trường: ${idx.fieldHints.join(', ')}. Điền đủ trước khi nộp.`
            : 'Điền đủ các trường trên form điện tử trước khi nộp.',
      },
      {
        keys: ['phu huynh', 'chu ky phu huynh'],
        answer: idx.needParentSignature
          ? 'Mẫu có dấu hiệu yêu cầu chữ ký / ý kiến phụ huynh — kiểm tra bước ký khi nộp.'
          : 'Không phát hiện bắt buộc chữ ký phụ huynh từ mẫu hiện có; vẫn kiểm tra lại khi nộp.',
      },
    ],
    fromStatic: false,
  };
};

export const buildRuntimeKb = (forms = []) => forms.map((f) => loaiDonToRuntimeEntry(f));

export const runtimeNeedKeywords = (runtimeKb = []) =>
  runtimeKb.map((p) => ({
    keys: p.needKeys || [],
    boost: p.boost?.length ? p.boost : (p.needKeys || []).slice(0, 3),
    hint: p.hint || p.displayName,
    procedureId: p.id,
  }));

export const findRuntimeByMessage = (runtimeKb, normalizedMessage = '') => {
  const msg = strip(normalizedMessage);
  let best = null;
  let bestScore = 0;
  for (const p of runtimeKb) {
    let score = 0;
    for (const k of p.needKeys || []) {
      const sk = strip(k);
      if (sk && msg.includes(sk)) score += Math.max(3, sk.split(' ').length);
    }
    for (const m of p.matchName || []) {
      const sm = strip(m);
      if (sm && msg.includes(sm)) score += 8;
    }
    const ten = strip(p.tenDon || p.displayName || '');
    if (ten && msg.includes(ten)) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore > 0 ? best : null;
};

export const findRuntimeByTenDon = (runtimeKb, tenDon = '') => {
  const n = strip(tenDon);
  return (
    runtimeKb.find((p) => strip(p.tenDon || '') === n) ||
    runtimeKb.find((p) => findKbByTenDon(tenDon)?.id === p.id && p.fromStatic) ||
    runtimeKb.find((p) => (p.matchName || []).some((m) => n.includes(strip(m)))) ||
    null
  );
};

export const findRuntimeById = (runtimeKb, id) => runtimeKb.find((p) => p.id === id) || null;
