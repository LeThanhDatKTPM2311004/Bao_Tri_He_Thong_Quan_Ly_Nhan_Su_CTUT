import {
  ADMIN_INTENT_CATALOG,
  ADMIN_HOW_TO,
  ADMIN_NAV_MAP,
  getAdminSuggestions,
} from './adminIntentCatalog.js';
import * as tools from './adminTools.js';
import { lookupLeadership, matchesLeadershipQuestion } from './leadershipLookup.js';

const stripDiacritics = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s@._+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const detectAdminIntent = (message) => {
  const normalized = stripDiacritics(message);
  if (!normalized || normalized.length < 2) {
    return { intentId: 'fallback', confidence: 0, normalized };
  }

  let best = { intentId: 'fallback', score: 0 };
  for (const item of ADMIN_INTENT_CATALOG) {
    let hit = 0;
    for (const pattern of item.patterns) {
      if (pattern.test(normalized)) hit += 1;
    }
    if (hit > 0) {
      const score = hit * (item.score || 1);
      if (score > best.score) best = { intentId: item.id, score };
    }
  }

  return {
    intentId: best.intentId,
    confidence: best.score > 0 ? Math.min(0.95, 0.4 + best.score / 40) : 0,
    normalized,
  };
};

const resolveNavigate = (normalized) => {
  for (const item of ADMIN_NAV_MAP) {
    if (item.keys.some((k) => normalized.includes(stripDiacritics(k)))) {
      return item;
    }
  }
  return null;
};

export const askAdmin = async ({ message, user }) => {
  const text = String(message || '').trim();
  if (text.length < 2) {
    return {
      intent: 'fallback',
      confidence: 0,
      answer: 'Anh/chị hãy nhập câu hỏi (ví dụ: thống kê tổng quan, tìm SV HTTT…, hồ sơ chờ duyệt).',
      actions: [],
      suggestions: getAdminSuggestions(),
    };
  }

  const { intentId, confidence, normalized } = detectAdminIntent(text);

  // Ưu tiên câu hỏi lãnh đạo (kể cả khi intent khác khớp nhẹ)
  if (intentId === 'org_leadership' || matchesLeadershipQuestion(text)) {
    const result = await lookupLeadership(text);
    if (result) {
      return { intent: 'org_leadership', confidence: Math.max(confidence, 0.9), ...result };
    }
  }

  if (intentId === 'dashboard_stats') {
    const result = await tools.getDashboardStats();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'users_search') {
    const result = await tools.searchUsers(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_sinh_vien') {
    const result = await tools.searchSinhVien(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_giang_vien') {
    const result = await tools.searchGiangVien(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_lop') {
    const result = await tools.listLop(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_khoa') {
    const result = await tools.listKhoa(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_bomon') {
    const result = await tools.listBoMon(text);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'org_quyen') {
    const result = await tools.listQuyen();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'workflow_steps') {
    const result = await tools.getFormWorkflowSteps(text, { portal: 'admin' });
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'forms_list') {
    const result = await tools.listForms();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'workflows_pending') {
    const result = await tools.getWorkflowPending();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'reports_summary') {
    const result = await tools.getReportsSummary();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'notifications') {
    const result = await tools.getNotifications(user?.id);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'settings_overview') {
    const result = await tools.getSettingsOverview();
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'account_me') {
    const result = await tools.getAccountMe(user?.id);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'how_to_import' || intentId === 'how_to_workflow' || intentId === 'how_to_users') {
    const howto = ADMIN_HOW_TO[intentId];
    return {
      intent: intentId,
      confidence,
      answer: howto.answer,
      actions: [{ type: 'navigate', path: howto.path, label: howto.label }],
      sources: ['faq:admin'],
    };
  }

  if (intentId === 'navigate_help') {
    const nav = resolveNavigate(normalized);
    if (nav) {
      return {
        intent: intentId,
        confidence,
        answer: `Mở mục **${nav.label}** tại đường dẫn \`${nav.path}\`. Bot không thay thao tác ghi dữ liệu — anh/chị thao tác trên trang đó.`,
        actions: [{ type: 'navigate', path: nav.path, label: `Mở ${nav.label}` }],
        sources: ['nav:admin'],
      };
    }
    return {
      intent: intentId,
      confidence,
      answer: [
        'Anh/chị muốn mở trang nào? Có thể nói:',
        '• mở quản lý người dùng',
        '• mở lớp sinh viên',
        '• mở mẫu word / quy trình / báo cáo / thông báo',
      ].join('\n'),
      actions: [
        { type: 'navigate', path: '/dashboard', label: 'Tổng quan' },
        { type: 'navigate', path: '/users', label: 'Người dùng' },
      ],
      sources: ['nav:admin'],
    };
  }

  // Heuristic: email / MSSV-like → search
  if (/@/.test(text) || /\b[A-Za-z]{0,6}\d{5,12}\b/.test(text)) {
    if (/sinh|sv|mssv/i.test(text) || /^[A-Za-z]{2,6}\d{5,}/i.test(text.trim())) {
      const result = await tools.searchSinhVien(text);
      return { intent: 'org_sinh_vien', confidence: 0.6, ...result };
    }
    const result = await tools.searchUsers(text);
    return { intent: 'users_search', confidence: 0.55, ...result };
  }

  const nav = resolveNavigate(normalized);
  if (nav && /mo |vao |trang |quan ly/.test(normalized)) {
    return {
      intent: 'navigate_help',
      confidence: 0.5,
      answer: `Điều hướng tới **${nav.label}**.`,
      actions: [{ type: 'navigate', path: nav.path, label: `Mở ${nav.label}` }],
      sources: ['nav:admin'],
    };
  }

  return {
    intent: 'fallback',
    confidence,
    answer: [
      'Em là thư ký trợ lý trang quản trị. Anh/chị có thể hỏi:',
      '• Hiệu trưởng / trưởng khoa (vd. trưởng khoa CNTT) / trưởng bộ môn',
      '• Thống kê tổng quan / báo cáo quy trình',
      '• Tìm user, SV, GV, lớp, khoa, bộ môn, quyền',
      '• Danh sách biểu mẫu & quy trình gắn',
      '• Các bước quy trình của một loại đơn (vd. đơn thôi học)',
      '• Hồ sơ chờ duyệt / quá hạn',
      '• Thông báo, trạng thái hệ thống, tài khoản của tôi',
      '• Hướng dẫn import Excel, gắn quy trình, quản lý user',
      '• Mở trang … để điều hướng nhanh',
      '',
      'Bot **đọc dữ liệu chi tiết** từ hệ thống; thao tác tạo/sửa/xóa thực hiện trên đúng trang admin.',
    ].join('\n'),
    actions: [
      { type: 'navigate', path: '/dashboard', label: 'Tổng quan' },
      { type: 'navigate', path: '/users', label: 'Người dùng' },
      { type: 'navigate', path: '/forms', label: 'Mẫu Word' },
    ],
    suggestions: getAdminSuggestions(),
    sources: [],
  };
};

export { getAdminSuggestions };
