import User from '../users/user.model.js';
import LoaiDon from '../importForms/LoaiDon.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import Lop from '../organization/models/lop.model.js';
import SinhVien from '../organization/models/sinhVien.model.js';
import GiangVien from '../organization/models/giangVien.model.js';
import Quyen from '../organization/models/quyen.model.js';
import GiangVienQuyen from '../organization/models/giangVienQuyen.model.js';
import Notification from '../notifications/notification.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import { Workflow, WorkflowInstance } from '../workflows/workflow.model.js';
import * as dashboardService from '../dashboard/dashboard.service.js';
import * as settingsService from '../settings/settings.service.js';
import { getWorkflowAggregates } from '../reports/aggregators/workflowStats.js';
import { ROLE_LABELS } from '../../config/roles.js';

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('vi-VN');
  } catch {
    return String(d);
  }
};

const activeFlag = (v) => (v === false ? 'Ngừng' : 'Đang hoạt động');

const WORKFLOW_STATUS_VI = {
  pending: 'Chờ xử lý',
  in_progress: 'Đang xử lý',
  overdue: 'Quá hạn',
  completed: 'Đã hoàn thành',
  rejected: 'Từ chối',
  cancelled: 'Đã hủy',
  approved: 'Đã phê duyệt',
};

const statusVi = (status) => WORKFLOW_STATUS_VI[status] || status || '—';

const ACTION_VI = {
  review: 'Xem xét',
  approve: 'Phê duyệt',
  sign: 'Ký',
  forward: 'Chuyển tiếp',
};

const stripDiacritics = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP_FORM = new Set([
  'don',
  'giay',
  'xin',
  'cua',
  'cac',
  'buoc',
  'quy',
  'trinh',
  'la',
  'gi',
  'nao',
  'co',
  'may',
  'ai',
  'duyet',
  'luong',
  'xu',
  'ly',
  'cho',
  'toi',
  'em',
  'anh',
  'chi',
]);

export const extractSearchQuery = (message = '') => {
  const raw = String(message || '').trim();
  const email = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (email) return email[0];

  const mssv = raw.match(/\b([A-Za-z]{0,6}\d{5,12})\b/);
  if (mssv) return mssv[1];

  const quoted = raw.match(/["']([^"']+)["']/);
  if (quoted) return quoted[1].trim();

  const after = raw.match(
    /(?:tim|tim kiem|theo|mssv|ma sv|ma gv|email|ten|voi)\s*[:\-]?\s*(.+)$/i,
  );
  if (after) {
    return after[1]
      .replace(/\?+$/, '')
      .replace(/^(la|gi|nao)\s+/i, '')
      .trim();
  }

  return '';
};

export const getDashboardStats = async () => {
  const stats = await dashboardService.getStats();
  const overdue = await WorkflowInstance.countDocuments({ status: 'overdue' });
  const lines = [
    '**Thống kê tổng quan hệ thống**',
    '',
    `• Tổng hồ sơ (workflow): **${stats.totalSubmissions}**`,
    `• Đang chờ / xử lý: **${stats.pendingApprovals}**`,
    `• Đã hoàn thành: **${stats.completedThisMonth}**`,
    `• Từ chối: **${stats.rejectedCount}**`,
    `• Quá hạn: **${overdue}**`,
    `• Tài khoản đang hoạt động: **${stats.totalUsers}**`,
    '',
    'Theo loại đơn (top):',
    ...(stats.byProcedure || []).slice(0, 6).map((p) => `• ${p.name}: ${p.value} (${p.percentage}%)`),
    '',
    'Hoạt động gần đây:',
    ...(stats.recent || [])
      .slice(0, 5)
      .map(
        (r, i) =>
          `${i + 1}. ${r.formName} — ${r.studentName}${r.studentId ? ` (${r.studentId})` : ''} — ${statusVi(r.status)} — ${fmtDate(r.updatedAt)}`,
      ),
  ];
  return {
    answer: lines.join('\n'),
    actions: [
      { type: 'navigate', path: '/dashboard', label: 'Mở Tổng quan' },
      { type: 'navigate', path: '/reports', label: 'Mở Báo cáo' },
    ],
    sources: ['db:dashboard'],
  };
};

export const searchUsers = async (message) => {
  const q = extractSearchQuery(message);
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ email: rx }, { fullName: rx }, { studentId: rx }, { phone: rx }];
  }

  const [total, rows] = await Promise.all([
    User.countDocuments(filter),
    User.find(filter)
      .sort({ updatedAt: -1 })
      .limit(q ? 8 : 12)
      .select(
        'fullName email role isActive studentId phone khoaId boMonId lopId lastLoginAt createdAt',
      )
      .populate('khoaId', 'code name')
      .populate('boMonId', 'code name')
      .populate('lopId', 'code name')
      .lean(),
  ]);

  if (!rows.length) {
    return {
      answer: q
        ? `Không tìm thấy tài khoản khớp ${q}. Thử email, họ tên hoặc MSSV.`
        : 'Chưa có tài khoản nào trong bộ lọc.',
      actions: [{ type: 'navigate', path: '/users', label: 'Mở Quản lý người dùng' }],
      sources: ['db:user'],
    };
  }

  const lines = rows.map((u, i) => {
    const roleLabel = ROLE_LABELS[u.role] || u.role;
    const bits = [
      `**${u.fullName}**`,
      u.email,
      `role: ${roleLabel}`,
      activeFlag(u.isActive),
    ];
    if (u.studentId) bits.push(`MSSV: ${u.studentId}`);
    if (u.phone) bits.push(`ĐT: ${u.phone}`);
    if (u.khoaId?.name) bits.push(`Khoa: ${u.khoaId.name}`);
    if (u.boMonId?.name) bits.push(`BM: ${u.boMonId.name}`);
    if (u.lopId?.name) bits.push(`Lớp: ${u.lopId.name}`);
    bits.push(`Đăng nhập gần nhất: ${fmtDate(u.lastLoginAt)}`);
    return `${i + 1}. ${bits.join(' · ')}`;
  });

  return {
    answer: [
      q ? `Kết quả tìm tài khoản ${q} (${total} khớp, hiện ${rows.length}):` : `Danh sách tài khoản gần đây (${total} tổng, hiện ${rows.length}):`,
      '',
      ...lines,
    ].join('\n'),
    actions: [{ type: 'navigate', path: '/users', label: 'Mở Quản lý người dùng' }],
    sources: ['db:user'],
  };
};

export const searchSinhVien = async (message) => {
  const q = extractSearchQuery(message);
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ maSV: rx }, { fullName: rx }, { email: rx }, { phone: rx }];
  }
  const [total, rows] = await Promise.all([
    SinhVien.countDocuments(filter),
    SinhVien.find(filter)
      .sort({ maSV: 1 })
      .limit(10)
      .populate('lopId', 'code name')
      .populate('khoaId', 'code name')
      .populate('boMonId', 'code name')
      .lean(),
  ]);

  if (!rows.length) {
    return {
      answer: q
        ? `Không tìm thấy sinh viên khớp ${q}.`
        : `Hiện có **${await SinhVien.countDocuments()}** sinh viên. Hỏi kèm MSSV hoặc tên, ví dụ: tìm SV HTTT2211016.`,
      actions: [{ type: 'navigate', path: '/organization/lop-sinh-vien', label: 'Mở Lớp & Sinh viên' }],
      sources: ['db:sinhVien'],
    };
  }

  const lines = rows.map((sv, i) => {
    const bits = [
      `**${sv.fullName}**`,
      `MSSV: ${sv.maSV}`,
      activeFlag(sv.isActive),
    ];
    if (sv.email) bits.push(sv.email);
    if (sv.phone) bits.push(`ĐT: ${sv.phone}`);
    if (sv.lopId) bits.push(`Lớp: ${sv.lopId.name || sv.lopId.code}`);
    if (sv.khoaId) bits.push(`Khoa: ${sv.khoaId.name || sv.khoaId.code}`);
    if (sv.boMonId) bits.push(`BM: ${sv.boMonId.name || sv.boMonId.code}`);
    if (sv.nganh) bits.push(`Ngành: ${sv.nganh}`);
    return `${i + 1}. ${bits.join(' · ')}`;
  });

  return {
    answer: [`Sinh viên (${total} khớp, hiện ${rows.length}):`, '', ...lines].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/lop-sinh-vien', label: 'Mở Lớp & Sinh viên' }],
    sources: ['db:sinhVien'],
  };
};

export const searchGiangVien = async (message) => {
  const q = extractSearchQuery(message);
  const filter = {};
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ maGV: rx }, { fullName: rx }, { email: rx }, { phone: rx }];
  }
  const [total, rows] = await Promise.all([
    GiangVien.countDocuments(filter),
    GiangVien.find(filter)
      .sort({ maGV: 1 })
      .limit(10)
      .populate('khoaId', 'code name')
      .populate('boMonId', 'code name')
      .lean(),
  ]);

  if (!rows.length) {
    return {
      answer: q ? `Không tìm thấy giảng viên khớp ${q}.` : `Tổng GV: **${await GiangVien.countDocuments()}**. Hỏi kèm mã GV hoặc tên.`,
      actions: [{ type: 'navigate', path: '/organization/giang-vien', label: 'Mở Giảng viên' }],
      sources: ['db:giangVien'],
    };
  }

  const lines = rows.map((gv, i) => {
    const bits = [`**${gv.fullName}**`, `Mã: ${gv.maGV}`, activeFlag(gv.isActive)];
    if (gv.email) bits.push(gv.email);
    if (gv.phone) bits.push(`ĐT: ${gv.phone}`);
    if (gv.khoaId) bits.push(`Khoa: ${gv.khoaId.name || gv.khoaId.code}`);
    if (gv.boMonId) bits.push(`BM: ${gv.boMonId.name || gv.boMonId.code}`);
    return `${i + 1}. ${bits.join(' · ')}`;
  });

  return {
    answer: [`Giảng viên (${total} khớp, hiện ${rows.length}):`, '', ...lines].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/giang-vien', label: 'Mở Giảng viên' }],
    sources: ['db:giangVien'],
  };
};

export const listKhoa = async (message) => {
  const q = extractSearchQuery(message);
  const filter = q
    ? { $or: [{ code: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] }
    : {};
  const [total, rows] = await Promise.all([
    Khoa.countDocuments(filter),
    Khoa.find(filter).sort({ code: 1 }).limit(20).lean(),
  ]);
  const lines = rows.map(
    (k, i) => `${i + 1}. **${k.name}** (${k.code}) — ${activeFlag(k.isActive)}`,
  );
  return {
    answer: [`Khoa (${total}):`, '', ...(lines.length ? lines : ['(trống)'])].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/khoa-bo-mon', label: 'Mở Khoa & Bộ môn' }],
    sources: ['db:khoa'],
  };
};

export const listBoMon = async (message) => {
  const q = extractSearchQuery(message);
  const filter = q
    ? { $or: [{ code: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] }
    : {};
  const [total, rows] = await Promise.all([
    BoMon.countDocuments(filter),
    BoMon.find(filter).sort({ code: 1 }).limit(20).populate('khoaId', 'code name').lean(),
  ]);
  const lines = rows.map((b, i) => {
    const khoa = b.khoaId ? `${b.khoaId.name || b.khoaId.code}` : '—';
    return `${i + 1}. **${b.name}** (${b.code}) — Khoa: ${khoa} — ${activeFlag(b.isActive)}`;
  });
  return {
    answer: [`Bộ môn (${total}):`, '', ...(lines.length ? lines : ['(trống)'])].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/khoa-bo-mon', label: 'Mở Khoa & Bộ môn' }],
    sources: ['db:boMon'],
  };
};

export const listLop = async (message) => {
  const q = extractSearchQuery(message);
  const filter = q
    ? { $or: [{ code: new RegExp(escapeRegex(q), 'i') }, { name: new RegExp(escapeRegex(q), 'i') }] }
    : {};
  const [total, rows] = await Promise.all([
    Lop.countDocuments(filter),
    Lop.find(filter)
      .sort({ code: 1 })
      .limit(15)
      .populate('khoaId', 'code name')
      .populate('boMonId', 'code name')
      .populate('coVanId', 'maGV fullName email')
      .lean(),
  ]);
  const lines = rows.map((l, i) => {
    const cv = l.coVanId
      ? `${l.coVanId.fullName}${l.coVanId.maGV ? ` (${l.coVanId.maGV})` : ''}`
      : 'chưa gán';
    return `${i + 1}. **${l.name}** (${l.code}) — Khoa: ${l.khoaId?.name || '—'} — CVHT: ${cv} — ${activeFlag(l.isActive)}`;
  });
  return {
    answer: [`Lớp (${total}, hiện ${rows.length}):`, '', ...(lines.length ? lines : ['(trống)'])].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/lop-sinh-vien', label: 'Mở Lớp & Sinh viên' }],
    sources: ['db:lop'],
  };
};

export const listQuyen = async () => {
  const [quyens, links] = await Promise.all([
    Quyen.find().sort({ code: 1 }).limit(30).lean(),
    GiangVienQuyen.countDocuments(),
  ]);
  const lines = quyens.map(
    (q, i) => `${i + 1}. **${q.name || q.ten || q.code}** (${q.code}) — ${activeFlag(q.isActive)}`,
  );
  return {
    answer: [
      `Danh mục quyền (${quyens.length}):`,
      '',
      ...(lines.length ? lines : ['(trống)']),
      '',
      `Số liên kết giảng viên–quyền: **${links}**`,
    ].join('\n'),
    actions: [{ type: 'navigate', path: '/organization/quyen', label: 'Mở Quản lý quyền' }],
    sources: ['db:quyen'],
  };
};

export const listForms = async () => {
  const forms = await LoaiDon.find().sort({ tenDon: 1 }).lean();
  const wf = await Workflow.find({ loaiDonId: { $in: forms.map((f) => f._id) } })
    .select('loaiDonId name isActive steps')
    .lean();
  const wfMap = new Map(wf.map((w) => [String(w.loaiDonId), w]));

  const lines = forms.map((f, i) => {
    const w = wfMap.get(String(f._id));
    const wfInfo = w
      ? `quy trình: ${w.name || 'có'} (${(w.steps || []).length} bước)`
      : 'chưa gắn quy trình';
    return `${i + 1}. **${f.tenDon}** — ${activeFlag(f.isActive)} — ${wfInfo}`;
  });

  const active = forms.filter((f) => f.isActive !== false).length;
  return {
    answer: [
      `Biểu mẫu / loại đơn: **${forms.length}** (đang mở: **${active}**)`,
      '',
      ...lines,
    ].join('\n'),
    actions: [
      { type: 'navigate', path: '/forms', label: 'Mở Mẫu Word gốc' },
      { type: 'navigate', path: '/workflows/pending', label: 'Mở Quy trình' },
    ],
    sources: ['db:loaiDon', 'db:workflow'],
  };
};

const scoreFormMatch = (form, msgNorm, tokens) => {
  const name = stripDiacritics(form.tenDon || '');
  if (!name) return 0;
  if (msgNorm.includes(name) || name.includes(msgNorm)) return 100 + name.length;
  let score = 0;
  for (const t of tokens) {
    if (t.length < 3 || STOP_FORM.has(t)) continue;
    if (name.includes(t)) score += t.length >= 5 ? 8 : 4;
  }
  return score;
};

const formatWorkflowSteps = (workflow) => {
  const steps = [...(workflow.steps || [])].sort(
    (a, b) => (a.stepOrder || 0) - (b.stepOrder || 0),
  );
  if (!steps.length) return ['(Quy trình chưa có bước nào)'];
  return steps.map((s, i) => {
    const order = s.stepOrder ?? i + 1;
    const role = ROLE_LABELS[s.role] || s.role || '—';
    const action = ACTION_VI[s.action] || s.action || '—';
    const deadline =
      s.deadlineDays && s.deadlineDays > 0 ? ` · hạn ${s.deadlineDays} ngày` : '';
    const name = s.stepName ? ` — ${s.stepName}` : '';
    return `${order}. **${role}** (${action})${name}${deadline}`;
  });
};

/**
 * Trả lời các bước quy trình gắn với loại đơn (từ DB Workflow).
 * @param {string} message
 * @param {{ portal?: 'admin' | 'student' }} [opts]
 */
export const getFormWorkflowSteps = async (message, opts = {}) => {
  const portal = opts.portal || 'admin';
  const msgNorm = stripDiacritics(message);
  const tokens = msgNorm.split(/\s+/).filter(Boolean);
  const forms = await LoaiDon.find().sort({ tenDon: 1 }).lean();

  const ranked = forms
    .map((f) => ({ form: f, score: scoreFormMatch(f, msgNorm, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    const list = forms.slice(0, 12).map((f, i) => `${i + 1}. ${f.tenDon}`);
    const who = portal === 'admin' ? 'Anh/chị' : 'Bạn';
    return {
      answer: [
        `${who} muốn xem quy trình của **đơn nào**? Hiện có:`,
        '',
        ...(list.length ? list : ['(chưa có loại đơn)']),
        '',
        'Ví dụ: *các bước quy trình đơn thôi học*, *quy trình đơn bảo lưu*.',
      ].join('\n'),
      actions:
        portal === 'admin'
          ? [
              { type: 'navigate', path: '/forms', label: 'Mở Mẫu Word gốc' },
              { type: 'navigate', path: '/workflows/pending', label: 'Mở Quy trình' },
            ]
          : [{ type: 'navigate', page: 'home', label: 'Danh sách thủ tục' }],
      sources: ['db:loaiDon'],
    };
  }

  const best = ranked[0];
  const near = ranked.filter((x) => x.score >= best.score * 0.85 && x.score >= 8);
  if (near.length > 1 && best.score < 40) {
    const who = portal === 'admin' ? 'Anh/chị' : 'Bạn';
    return {
      answer: [
        `Có vài loại đơn khớp gần. ${who} hỏi rõ tên đơn hơn:`,
        '',
        ...near.slice(0, 5).map((x, i) => `${i + 1}. ${x.form.tenDon}`),
      ].join('\n'),
      actions:
        portal === 'admin'
          ? [{ type: 'navigate', path: '/forms', label: 'Mở Mẫu Word gốc' }]
          : [{ type: 'navigate', page: 'home', label: 'Danh sách thủ tục' }],
      sources: ['db:loaiDon'],
    };
  }

  const form = best.form;
  let workflow = await Workflow.findOne({ loaiDonId: form._id, isActive: { $ne: false } }).lean();
  if (!workflow) {
    workflow = await Workflow.findOne({ loaiDonId: form._id }).lean();
  }

  if (!workflow) {
    const who = portal === 'admin' ? 'Anh/chị' : 'Bạn';
    return {
      answer: [
        `**${form.tenDon}**`,
        '',
        'Loại đơn này **chưa gắn quy trình duyệt** trên hệ thống.',
        portal === 'admin'
          ? `${who} vào Quản lý quy trình để tạo bước và gắn với loại đơn này.`
          : 'Khi nộp đơn, hệ thống sẽ áp dụng quy trình mặc định (nếu có). Liên hệ CVHT/phòng ban nếu cần biết ai duyệt.',
      ].join('\n'),
      actions:
        portal === 'admin'
          ? [
              { type: 'navigate', path: '/workflows/pending', label: 'Mở Quy trình' },
              { type: 'navigate', path: '/forms', label: 'Mở Mẫu Word gốc' },
            ]
          : [{ type: 'navigate', page: 'home', label: 'Danh sách thủ tục' }],
      sources: ['db:loaiDon', 'db:workflow'],
    };
  }

  const stepLines = formatWorkflowSteps(workflow);
  const inactiveNote = workflow.isActive === false ? ' (đang tắt)' : '';

  return {
    answer: [
      `**Các bước quy trình — ${form.tenDon}**`,
      `Quy trình: ${workflow.name || 'Không tên'}${inactiveNote} · **${(workflow.steps || []).length} bước**`,
      '',
      ...stepLines,
      '',
      'Thứ tự từ trên xuống: hồ sơ đi lần lượt qua từng bước đến khi hoàn tất hoặc bị từ chối.',
    ].join('\n'),
    actions:
      portal === 'admin'
        ? [
            { type: 'navigate', path: '/workflows/pending', label: 'Mở Quy trình / hồ sơ' },
            { type: 'navigate', path: '/forms', label: 'Mở Mẫu Word gốc' },
          ]
        : [
            {
              type: 'navigate',
              page: 'form',
              loaiDonId: String(form._id),
              label: `Nộp: ${form.tenDon}`,
            },
            { type: 'navigate', page: 'home', label: 'Danh sách thủ tục' },
          ],
    sources: ['db:loaiDon', 'db:workflow'],
  };
};

export const getWorkflowPending = async () => {
  const [pending, inProgress, overdue, recent] = await Promise.all([
    WorkflowInstance.countDocuments({ status: 'pending' }),
    WorkflowInstance.countDocuments({ status: 'in_progress' }),
    WorkflowInstance.countDocuments({ status: 'overdue' }),
    WorkflowInstance.find({ status: { $in: ['pending', 'in_progress', 'overdue'] } })
      .sort({ updatedAt: -1 })
      .limit(8)
      .populate({
        path: 'generatedFileId',
        model: GeneratedFile,
        select: 'tenDon tenNguoiGui trangThai',
      })
      .lean(),
  ]);

  const lines = recent.map((inst, i) => {
    const file = inst.generatedFileId;
    return `${i + 1}. ${file?.tenDon || 'Hồ sơ'} — ${file?.tenNguoiGui || '—'} — **${statusVi(inst.status)}** — bước ${inst.currentStepOrder || '?'} — ${fmtDate(inst.updatedAt)}`;
  });

  return {
    answer: [
      '**Hồ sơ / quy trình đang mở**',
      `• Chờ xử lý: **${pending}**`,
      `• Đang xử lý: **${inProgress}**`,
      `• Quá hạn: **${overdue}**`,
      '',
      'Danh sách gần đây:',
      ...(lines.length ? lines : ['(không có hồ sơ chờ)']),
    ].join('\n'),
    actions: [
      { type: 'navigate', path: '/workflows/pending', label: 'Mở chờ duyệt' },
      { type: 'navigate', path: '/workflows/processed', label: 'Mở đã xử lý' },
    ],
    sources: ['db:workflowInstance'],
  };
};

export const getReportsSummary = async () => {
  const data = await getWorkflowAggregates({});
  const s = data?.summary || {};
  const lines = [
    '**Tóm tắt báo cáo quy trình**',
    `• Tổng: **${s.total ?? '—'}**`,
    `• Chờ: **${s.pending ?? '—'}** · Đang xử lý: **${s.inProgress ?? '—'}** · Chờ xử lý gộp: **${s.waiting ?? '—'}**`,
    `• Hoàn thành: **${s.completed ?? '—'}** (${s.completionRate ?? '—'}%) · Từ chối: **${s.rejected ?? '—'}** · Quá hạn: **${s.overdue ?? '—'}**`,
    `• Thời gian xử lý TB: **${s.avgProcessingDays ?? '—'}** ngày`,
  ];
  if (Array.isArray(data?.byStatus) && data.byStatus.length) {
    lines.push('', 'Theo trạng thái:');
    data.byStatus.forEach((row) => {
      lines.push(`• ${row.label || row.status}: ${row.count}`);
    });
  }
  if (Array.isArray(data?.byProcedure)) {
    lines.push('', 'Theo thủ tục (top):');
    data.byProcedure.slice(0, 6).forEach((p) => {
      lines.push(`• ${p.name}: ${p.value} (${p.percentage}%)`);
    });
  }
  return {
    answer: lines.join('\n'),
    actions: [{ type: 'navigate', path: '/reports', label: 'Mở Báo cáo & Thống kê' }],
    sources: ['db:reports'],
  };
};

export const getNotifications = async (userId) => {
  if (!userId) {
    return {
      answer: 'Không xác định được admin đang đăng nhập.',
      actions: [],
      sources: [],
    };
  }
  const [unread, recent] = await Promise.all([
    Notification.countDocuments({ recipientId: userId, isRead: false }),
    Notification.find({ recipientId: userId }).sort({ createdAt: -1 }).limit(8).lean(),
  ]);
  const lines = recent.map(
    (n, i) =>
      `${i + 1}. ${n.isRead ? '' : '*(chưa đọc)* '}**${n.title}** — ${n.message} — ${fmtDate(n.createdAt)}`,
  );
  return {
    answer: [
      `Thông báo của bạn — chưa đọc: **${unread}**`,
      '',
      ...(lines.length ? lines : ['(chưa có thông báo)']),
    ].join('\n'),
    actions: [{ type: 'navigate', path: '/notifications', label: 'Mở Thông báo' }],
    sources: ['db:notification'],
  };
};

export const getSettingsOverview = async () => {
  const o = await settingsService.getOverview();
  const lines = [
    '**Trạng thái hệ thống / tích hợp**',
    `• Môi trường: **${o.system?.nodeEnv}** · version: ${o.system?.version}`,
    `• Server time: ${o.system?.serverTime}`,
    `• MongoDB: **${o.database?.label}** ${o.database?.host ? `(${o.database.host})` : ''}`,
    `• Email: **${o.integrations?.email?.label}** ${o.integrations?.email?.from ? `· from ${o.integrations.email.from}` : ''}`,
    `• Google OAuth: **${o.integrations?.google?.label}**`,
    `• Cloudinary: **${o.integrations?.cloudinary?.label}**`,
    `• CA chữ ký số: **${o.integrations?.ca?.label}**`,
    `• Portal admin: ${o.portals?.adminPortalUrl || '—'}`,
    `• Portal SV: ${o.portals?.studentPortalUrl || '—'}`,
  ];
  return {
    answer: lines.join('\n'),
    actions: [{ type: 'navigate', path: '/account', label: 'Mở Tài khoản' }],
    sources: ['settings:overview'],
  };
};

export const getAccountMe = async (userId) => {
  const u = await User.findById(userId)
    .select('fullName email role isActive phone lastLoginAt createdAt googleEmail signatureImageUrl')
    .lean();
  if (!u) {
    return {
      answer: 'Không tìm thấy tài khoản.',
      actions: [{ type: 'navigate', path: '/account', label: 'Mở Tài khoản' }],
      sources: ['db:user'],
    };
  }
  return {
    answer: [
      '**Tài khoản admin đang đăng nhập**',
      `• Họ tên: **${u.fullName}**`,
      `• Email: ${u.email}`,
      `• Vai trò: ${ROLE_LABELS[u.role] || u.role}`,
      `• Trạng thái: ${activeFlag(u.isActive)}`,
      `• Điện thoại: ${u.phone || '—'}`,
      `• Google: ${u.googleEmail || 'chưa liên kết'}`,
      `• Chữ ký ảnh: ${u.signatureImageUrl ? 'đã có' : 'chưa có'}`,
      `• Đăng nhập gần nhất: ${fmtDate(u.lastLoginAt)}`,
      `• Tạo lúc: ${fmtDate(u.createdAt)}`,
    ].join('\n'),
    actions: [{ type: 'navigate', path: '/account', label: 'Mở Tài khoản & chữ ký' }],
    sources: ['db:user'],
  };
};
