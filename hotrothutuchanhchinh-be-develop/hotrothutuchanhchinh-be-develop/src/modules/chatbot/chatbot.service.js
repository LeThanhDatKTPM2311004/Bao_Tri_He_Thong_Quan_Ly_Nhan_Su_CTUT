import LoaiDon from '../importForms/LoaiDon.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import User from '../users/user.model.js';
import SinhVien from '../organization/models/sinhVien.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import Lop from '../organization/models/lop.model.js';
import { INTENT_CATALOG, NEED_KEYWORDS, FAQ_ENTRIES } from './intentCatalog.js';
import {
  PROCEDURE_KB,
  findCompare,
  matchFaqInKb,
  buildProcedureOverview,
  buildRuntimeKb,
  runtimeNeedKeywords,
  findRuntimeByMessage,
  findRuntimeById,
} from './procedureKnowledge.js';
import { ensureActiveFormsIndexed } from './procedureIndexer.js';
import { lookupLeadership, matchesLeadershipQuestion } from './leadershipLookup.js';
import { getFormWorkflowSteps } from './adminTools.js';
import * as studentProgressService from '../workflows/studentProgress.service.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { ensureStudentUserLinked } from '../users/studentProfile.service.js';

const stripDiacritics = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const disclaimer =
  'Gợi ý mang tính hỗ trợ thao tác trên cổng dịch vụ công; điều kiện được duyệt do đơn vị có thẩm quyền xem xét.';

/** Load đơn active + tự index + KB runtime (mọi lần hỏi) */
const loadRuntimeContext = async () => {
  const forms = await ensureActiveFormsIndexed();
  const runtimeKb = buildRuntimeKb(forms);
  const needKeywords = [
    ...NEED_KEYWORDS,
    ...runtimeNeedKeywords(runtimeKb).filter(
      (n) => !NEED_KEYWORDS.some((s) => s.procedureId === n.procedureId),
    ),
  ];
  return { forms, runtimeKb, needKeywords };
};

export const detectIntent = (message, needKeywords = NEED_KEYWORDS) => {
  const normalized = stripDiacritics(message);
  if (!normalized || normalized.length < 2) {
    return { intentId: 'fallback', confidence: 0, normalized };
  }

  let best = { intentId: 'fallback', score: 0 };
  for (const item of INTENT_CATALOG) {
    let hit = 0;
    for (const pattern of item.patterns) {
      if (pattern.test(normalized)) hit += 1;
    }
    if (hit > 0) {
      const score = hit * (item.score || 1);
      if (score > best.score) {
        best = { intentId: item.id, score, requiresAuth: !!item.requiresAuth };
      }
    }
  }

  const staffOrAccountIntents = new Set([
    'my_advisor',
    'my_faculty_dean',
    'my_department_chair',
    'my_org_contacts',
    'my_submissions',
    'navigate_my_forms',
    'login_help',
    'forgot_password',
    'explain_procedure',
    'compare_procedures',
    'list_procedures',
    'org_leadership',
  ]);
  const needHit = needKeywords.some((n) =>
    n.keys.some((k) => normalized.includes(stripDiacritics(k))),
  );
  if (needHit && best.intentId === 'fallback') {
    return { intentId: 'recommend_procedure', confidence: 0.7, normalized };
  }
  if (needHit && best.score < 20 && !staffOrAccountIntents.has(best.intentId)) {
    return { intentId: 'recommend_procedure', confidence: 0.75, normalized };
  }

  return {
    intentId: best.intentId,
    confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score / 40) : 0,
    normalized,
    requiresAuth: best.requiresAuth,
  };
};

const faqForIntent = (intentId) => FAQ_ENTRIES.find((e) => e.intent === intentId) || null;

const STOP_TOKENS = new Set([
  'em',
  'toi',
  'ban',
  'muon',
  'can',
  'lam',
  'thi',
  'nao',
  'voi',
  'cua',
  'cho',
  'mot',
  'cac',
  'va',
  'hoac',
  'don',
  'thu',
  'tuc',
  'phu',
  'hop',
  'giup',
  'hoi',
  'xin',
  'duoc',
  'hay',
  'nhe',
  'the',
  'nao',
  'sao',
  'de',
  'tu',
  'la',
  'trong',
  'he',
  'thong',
]);

const scoreProcedure = (form, runtimeEntry, normalizedMessage, needBoosts = [], matchedNeedIds = []) => {
  const name = stripDiacritics(form.tenDon || '');
  const desc = stripDiacritics(form.description || '');
  const idxText = stripDiacritics(
    [
      ...(form.chatbotIndex?.keywords || []),
      form.chatbotIndex?.purposeSnippet || '',
      ...(runtimeEntry?.boost || []),
    ].join(' '),
  );
  const hay = `${name} ${desc} ${idxText}`;
  let score = 0;
  let boostHits = 0;

  for (const boost of needBoosts) {
    const b = stripDiacritics(boost);
    if (!b) continue;
    if (name.includes(b)) {
      score += 20;
      boostHits += 1;
    } else if (hay.includes(b)) {
      score += 12;
      boostHits += 1;
    }
  }

  if (runtimeEntry && matchedNeedIds.includes(runtimeEntry.id)) {
    score += 25;
    boostHits += 1;
  }

  const tokens = normalizedMessage.split(' ').filter((t) => t.length >= 4 && !STOP_TOKENS.has(t));
  for (const token of tokens) {
    if (name.includes(token)) score += 3;
    else if (hay.includes(token)) score += 1;
  }

  return { score, boostHits };
};

const formFromRuntime = (forms, kb) => {
  if (!kb) return null;
  if (kb.loaiDonId) {
    return forms.find((f) => String(f._id) === String(kb.loaiDonId)) || null;
  }
  return forms.find((f) => stripDiacritics(f.tenDon) === stripDiacritics(kb.tenDon || kb.displayName || '')) || null;
};

const actionsForForm = (form, kb) => {
  if (!form) {
    return [{ type: 'navigate', page: 'home', label: 'Xem danh sách thủ tục' }];
  }
  return [
    {
      type: 'navigate',
      page: 'detail',
      recordId: String(form._id),
      label: `Nộp: ${form.tenDon || kb?.displayName || 'thủ tục'}`,
    },
    { type: 'navigate', page: 'home', label: 'Danh sách thủ tục' },
  ];
};

/** Giải thích thủ tục theo KB runtime (DB + KB tĩnh) */
export const explainProcedure = async (message, ctx) => {
  const context = ctx || (await loadRuntimeContext());
  const { forms, runtimeKb } = context;
  const normalized = stripDiacritics(message);
  const kb = findRuntimeByMessage(runtimeKb, normalized);
  if (!kb) {
    return {
      answer: [
        `Bạn đang hỏi về thủ tục nào? Hiện cổng có ${forms.length} đơn đang mở:`,
        ...forms.map((f, i) => `${i + 1}. ${f.tenDon}`),
        '',
        'Ví dụ: đơn … là gì?, em muốn … thì làm đơn nào?',
      ].join('\n'),
      actions: [{ type: 'navigate', page: 'home', label: 'Xem thủ tục' }],
      sources: ['db:loaiDon', 'kb:runtime'],
    };
  }

  const form = formFromRuntime(forms, kb);
  const faq = matchFaqInKb(kb, normalized);
  const wantsOverview =
    !faq ||
    /la gi|muc dich|dung (de|khi)|huong dan|gioi thieu ve|chi tiet/.test(normalized);

  let answer;
  if (faq && !wantsOverview) {
    answer = [`**${kb.displayName}**`, '', faq.answer, '', disclaimer].join('\n');
  } else if (faq && wantsOverview) {
    answer = [buildProcedureOverview(kb), '', `→ ${faq.answer}`, '', disclaimer].join('\n');
  } else {
    answer = [buildProcedureOverview(kb), '', disclaimer].join('\n');
  }

  return {
    answer,
    suggestions: [{ id: form?._id, tenDon: form?.tenDon || kb.displayName, description: kb.purpose }],
    actions: actionsForForm(form, kb),
    sources: ['kb:runtime', 'db:loaiDon'],
  };
};

export const compareProceduresAnswer = async (message, ctx) => {
  const context = ctx || (await loadRuntimeContext());
  const { forms, runtimeKb } = context;
  const normalized = stripDiacritics(message);
  const cmp = findCompare(normalized);
  if (!cmp) {
    const hits = runtimeKb.filter(
      (p) =>
        (p.matchName || []).some((m) => normalized.includes(stripDiacritics(m))) ||
        (p.needKeys || []).some((k) => normalized.includes(stripDiacritics(k))),
    );
    if (hits.length >= 2) {
      const [a, b] = hits;
      const formA = formFromRuntime(forms, a);
      const formB = formFromRuntime(forms, b);
      return {
        answer: [
          `So sánh nhanh **${a.displayName}** và **${b.displayName}**:`,
          '',
          `• ${a.displayName}: ${a.purpose}`,
          `• ${b.displayName}: ${b.purpose}`,
          '',
          'Chọn đúng nhu cầu rồi nộp trên cổng.',
          disclaimer,
        ].join('\n'),
        actions: [...actionsForForm(formA, a).slice(0, 1), ...actionsForForm(formB, b).slice(0, 1)],
        sources: ['kb:runtime'],
      };
    }
    return explainProcedure(message, context);
  }

  const resolved = cmp.procedureIds.map((id) => findRuntimeById(runtimeKb, id) || PROCEDURE_KB.find((p) => p.id === id));
  return {
    answer: [cmp.answer, '', disclaimer].join('\n'),
    actions: resolved.filter(Boolean).flatMap((kb) => {
      const form = formFromRuntime(forms, kb);
      return actionsForForm(form, kb).slice(0, 1);
    }),
    sources: ['kb:procedures'],
  };
};

const clarifyRetakeCourse = (normalized) => {
  if (!/(thi rot|hoc lai mon|diem liet|diem kem|hoc cai thien)/.test(normalized)) return null;
  if (/(het bao luu|sau (bao luu|tam nghi)|tro lai hoc|quay lai hoc)/.test(normalized)) return null;
  return {
    answer: [
      'Nếu bạn **thi rớt / muốn học lại một môn**, đó thường là quy trình học vụ (đăng ký học phần) — không phải mặc định dùng mẫu đơn học lại trên cổng này.',
      '',
      'Mẫu **Đơn học lại** trên hệ thống dùng khi đã **bảo lưu/tạm nghỉ** và muốn **trở lại trường**.',
      'Bạn nên hỏi CVHT/Khoa trước. Nếu đúng là quay lại sau bảo lưu, hãy nộp Đơn học lại.',
      disclaimer,
    ].join('\n'),
    actions: [{ type: 'navigate', page: 'home', label: 'Xem thủ tục trên cổng' }],
    sources: ['kb:procedures'],
  };
};

export const recommendProcedures = async (message, ctx) => {
  const context = ctx || (await loadRuntimeContext());
  const { forms, runtimeKb, needKeywords } = context;
  const normalized = stripDiacritics(message);

  const retakeNote = clarifyRetakeCourse(normalized);
  if (retakeNote && !/(bao luu|tam nghi|thoi hoc|the sinh vien|hoan canh|thuc tap|gioi thieu)/.test(normalized)) {
    if (/(hoc lai|thi rot)/.test(normalized)) {
      return retakeNote;
    }
  }

  const matchedNeeds = needKeywords.filter((n) =>
    n.keys.some((k) => normalized.includes(stripDiacritics(k))),
  );
  const boosts = matchedNeeds.flatMap((n) => n.boost);
  const hint = matchedNeeds.map((n) => n.hint).join('; ');
  const matchedNeedIds = matchedNeeds.map((n) => n.procedureId).filter(Boolean);

  let ranked = forms
    .map((f) => {
      const kb = runtimeKb.find((e) => String(e.loaiDonId) === String(f._id));
      const { score, boostHits } = scoreProcedure(f, kb, normalized, boosts, matchedNeedIds);
      return { ...f, score, boostHits, kb };
    })
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || b.boostHits - a.boostHits);

  if (matchedNeeds.length > 0) {
    const needIds = new Set(matchedNeedIds);
    if (
      needIds.has('bao_luu') &&
      needIds.has('hoc_lai') &&
      /(het |sau ).*(bao luu|tam nghi)|(quay lai|tro lai) hoc|vao lai lop/.test(normalized)
    ) {
      needIds.delete('bao_luu');
    }
    const byId = ranked.filter((f) => f.kb && needIds.has(f.kb.id));
    if (byId.length > 0) ranked = byId;
    else {
      const boosted = ranked.filter((f) => f.boostHits > 0);
      ranked = boosted.length > 0 ? boosted : [];
    }
  }

  ranked = ranked.slice(0, 3);

  if (ranked.length === 0) {
    const sample = forms.slice(0, 8);
    return {
      answer:
        matchedNeeds.length > 0
          ? `Em hiểu nhu cầu liên quan ${hint}, nhưng hiện chưa khớp chắc với mẫu đơn đang mở. Bạn có thể xem danh sách bên dưới hoặc liên hệ CVHT/Khoa. ${disclaimer}`
          : `Chưa xác định rõ thủ tục. Hãy nói rõ hơn (tên/gần đúng tên đơn hoặc nhu cầu), hoặc chọn trong danh sách thủ tục đang mở. ${disclaimer}`,
      suggestions: sample.map((f) => ({
        id: f._id,
        tenDon: f.tenDon,
        description: f.chatbotIndex?.purposeSnippet || f.description || '',
      })),
      actions: [
        { type: 'navigate', page: 'home', label: 'Xem danh sách thủ tục' },
        ...sample.slice(0, 2).map((f) => ({
          type: 'navigate',
          page: 'detail',
          recordId: String(f._id),
          label: `Nộp: ${f.tenDon}`,
        })),
      ],
      sources: ['db:loaiDon', 'kb:runtime'],
    };
  }

  const lines = ranked.map((f, i) => {
    const purpose = f.kb?.purpose || f.chatbotIndex?.purposeSnippet || f.description || '';
    return `${i + 1}. **${f.tenDon}**${purpose ? `\n   ${purpose}` : ''}`;
  });

  const tip = ranked[0]?.kb?.needParentSignature
    ? '\nLưu ý: thủ tục này có thể cần chữ ký phụ huynh.'
    : '';

  return {
    answer: [
      hint ? `Theo nhu cầu ${hint},` : 'Theo mô tả của bạn,',
      'thủ tục phù hợp trên hệ thống là:',
      '',
      ...lines,
      tip,
      '',
      'Chọn nút bên dưới để nộp, hoặc hỏi [tên đơn] là gì? để xem chi tiết.',
      disclaimer,
    ].join('\n'),
    suggestions: ranked.map((f) => ({
      id: f._id,
      tenDon: f.tenDon,
      description: f.kb?.purpose || f.chatbotIndex?.purposeSnippet || '',
      score: f.score,
    })),
    actions: ranked.map((f) => ({
      type: 'navigate',
      page: 'detail',
      recordId: String(f._id),
      label: `Nộp: ${f.tenDon}`,
    })),
    sources: ['db:loaiDon', 'kb:runtime'],
  };
};

export const listActiveProcedures = async (ctx) => {
  const context = ctx || (await loadRuntimeContext());
  const { forms, runtimeKb } = context;

  if (!forms.length) {
    return {
      answer: 'Hiện chưa có thủ tục nào đang mở trên hệ thống.',
      actions: [],
      sources: ['db:loaiDon'],
    };
  }

  const lines = forms.map((f, i) => {
    const kb = runtimeKb.find((e) => String(e.loaiDonId) === String(f._id));
    const purpose = kb?.purpose || f.chatbotIndex?.purposeSnippet || f.description || '';
    return `${i + 1}. **${f.tenDon}**${purpose ? `\n   ${purpose}` : ''}`;
  });

  return {
    answer: [
      `Các thủ tục đang mở trên cổng (${forms.length} mẫu) — tự cập nhật theo đơn trên hệ thống:`,
      '',
      ...lines,
      '',
      'Hỏi thêm: em muốn … thì làm đơn nào?, [tên đơn] là gì?',
    ].join('\n'),
    actions: [
      { type: 'navigate', page: 'home', label: 'Mở danh sách thủ tục' },
      ...forms.slice(0, 3).map((f) => ({
        type: 'navigate',
        page: 'detail',
        recordId: String(f._id),
        label: `Nộp: ${f.tenDon}`,
      })),
    ],
    sources: ['db:loaiDon', 'kb:runtime'],
  };
};

export const listMySubmissions = async (user) => {
  if (!user?.id || user.role !== 'student') {
    return {
      answer: 'Để xem hồ sơ của bạn, vui lòng đăng nhập bằng tài khoản sinh viên.',
      actions: [{ type: 'navigate', page: 'login', label: 'Đăng nhập' }],
      sources: [],
      needLogin: true,
    };
  }

  const files = await GeneratedFile.find({ submittedBy: user.id })
    .sort({ createdAt: -1 })
    .limit(8)
    .select('_id tenDon trangThai createdAt loaiDonId currentStepOrder');

  if (!files.length) {
    return {
      answer: 'Bạn chưa có hồ sơ nào trên hệ thống. Hãy chọn thủ tục trên trang chủ để nộp đơn đầu tiên.',
      actions: [{ type: 'navigate', page: 'home', label: 'Chọn thủ tục' }],
      sources: ['db:generatedFile'],
    };
  }

  const enriched = await studentProgressService.enrichStudentSubmissions(files);
  const lines = enriched.map((item, i) => {
    const status = item.progress?.statusDisplay || item.trangThai || '—';
    const canWithdraw = ['cho_duyet', 'tre_han', 'nhap'].includes(item.trangThai);
    const can = canWithdraw ? ' (có thể rút)' : '';
    return `${i + 1}. ${item.tenDon} — ${status}${can}`;
  });

  const firstOpen =
    enriched.find((x) => ['cho_duyet', 'tre_han', 'nhap'].includes(x.trangThai)) || enriched[0];

  return {
    answer: [
      'Các hồ sơ gần đây của bạn:',
      '',
      ...lines,
      '',
      'Chọn nút bên dưới để xem tiến độ chi tiết. ' + disclaimer,
    ].join('\n'),
    actions: [
      { type: 'navigate', page: 'search', label: 'Hồ sơ của tôi' },
      ...(firstOpen
        ? [
            {
              type: 'navigate',
              page: 'submission',
              submissionId: String(firstOpen._id),
              label: `Tiến độ: ${firstOpen.tenDon}`,
            },
          ]
        : []),
    ],
    sources: ['db:generatedFile', 'db:progress'],
  };
};

const formatPersonLine = (title, person) => {
  if (!person) return `- **${title}**: chưa có dữ liệu trên hệ thống.`;
  const bits = [person.fullName];
  if (person.maGV) bits.push(`Mã GV: ${person.maGV}`);
  if (person.email) bits.push(person.email);
  if (person.phone) bits.push(`ĐT: ${person.phone}`);
  return `- **${title}**: ${bits.join(' · ')}`;
};

const findActiveLeader = async (role, filter) => {
  const user = await User.findOne({ role, isActive: true, ...filter })
    .select('fullName email phone giangVienId')
    .lean();
  if (!user) return null;
  return {
    fullName: user.fullName,
    email: user.email || '',
    phone: user.phone || '',
    maGV: '',
  };
};

/**
 * Tra cứu cán bộ liên quan tới SV đăng nhập (cố vấn lớp, trưởng khoa, trưởng bộ môn…).
 * scope: advisor | faculty | department | all
 */
export const lookupMyStaff = async (user, scope = 'all') => {
  if (!user?.id || user.role !== 'student') {
    return {
      answer: 'Để xem cố vấn / lãnh đạo khoa–bộ môn của bạn, vui lòng đăng nhập bằng tài khoản sinh viên.',
      actions: [{ type: 'navigate', page: 'login', label: 'Đăng nhập' }],
      sources: [],
      needLogin: true,
    };
  }

  let account = await User.findById(user.id);
  if (!account) {
    return {
      answer: 'Không tìm thấy tài khoản sinh viên. Vui lòng đăng nhập lại.',
      actions: [{ type: 'navigate', page: 'login', label: 'Đăng nhập' }],
      sources: [],
    };
  }

  account = await ensureStudentUserLinked(account);

  const sinhVien = account.sinhVienId
    ? await SinhVien.findById(account.sinhVienId).select('maSV fullName lopId khoaId boMonId')
    : null;

  if (!sinhVien) {
    return {
      answer:
        'Tài khoản chưa gắn hồ sơ sinh viên trong hệ thống tổ chức (lớp/khoa). Vui lòng liên hệ Admin hoặc Khoa để được cập nhật.',
      actions: [{ type: 'navigate', page: 'profile', label: 'Xem hồ sơ cá nhân' }],
      sources: ['db:user'],
    };
  }

  const [lop, khoa, boMon] = await Promise.all([
    sinhVien.lopId
      ? Lop.findById(sinhVien.lopId)
          .populate('coVanId', 'maGV fullName email phone')
          .select('code name coVanId')
      : null,
    sinhVien.khoaId ? Khoa.findById(sinhVien.khoaId).select('code name') : null,
    sinhVien.boMonId ? BoMon.findById(sinhVien.boMonId).select('code name') : null,
  ]);

  const advisorGv = lop?.coVanId && typeof lop.coVanId === 'object' ? lop.coVanId : null;
  const advisor = advisorGv
    ? {
        fullName: advisorGv.fullName,
        maGV: advisorGv.maGV || '',
        email: advisorGv.email || '',
        phone: advisorGv.phone || '',
      }
    : null;

  const [facultyDean, deputyFaculty, deptChair, deputyDept] = await Promise.all([
    sinhVien.khoaId
      ? findActiveLeader(ROLES.FACULTY_MANAGER, { khoaId: sinhVien.khoaId })
      : null,
    sinhVien.khoaId
      ? findActiveLeader(ROLES.DEPUTY_FACULTY_MANAGER, { khoaId: sinhVien.khoaId })
      : null,
    sinhVien.boMonId
      ? findActiveLeader(ROLES.DEPARTMENT_CHAIR, { boMonId: sinhVien.boMonId })
      : null,
    sinhVien.boMonId
      ? findActiveLeader(ROLES.DEPUTY_DEPARTMENT_CHAIR, { boMonId: sinhVien.boMonId })
      : null,
  ]);

  const contextLines = [
    `Sinh viên: **${sinhVien.fullName}** (${sinhVien.maSV})`,
    lop ? `Lớp: **${lop.name}** (${lop.code})` : 'Lớp: chưa gắn',
    khoa ? `Khoa: **${khoa.name}**` : 'Khoa: chưa gắn',
    boMon ? `Bộ môn: **${boMon.name}**` : 'Bộ môn: chưa gắn',
  ];

  const lines = [];
  const includeAdvisor = scope === 'all' || scope === 'advisor';
  const includeFaculty = scope === 'all' || scope === 'faculty';
  const includeDepartment = scope === 'all' || scope === 'department';

  if (includeAdvisor) {
    lines.push(formatPersonLine('Cố vấn học tập (lớp)', advisor));
  }
  if (includeFaculty) {
    lines.push(formatPersonLine(ROLE_LABELS[ROLES.FACULTY_MANAGER], facultyDean));
    if (deputyFaculty) {
      lines.push(formatPersonLine(ROLE_LABELS[ROLES.DEPUTY_FACULTY_MANAGER], deputyFaculty));
    }
  }
  if (includeDepartment) {
    lines.push(formatPersonLine(ROLE_LABELS[ROLES.DEPARTMENT_CHAIR], deptChair));
    if (deputyDept) {
      lines.push(formatPersonLine(ROLE_LABELS[ROLES.DEPUTY_DEPARTMENT_CHAIR], deputyDept));
    }
  }

  const missingNote =
    (includeAdvisor && !advisor) ||
    (includeFaculty && !facultyDean) ||
    (includeDepartment && !deptChair)
      ? '\n\nNếu thiếu thông tin, dữ liệu có thể chưa được Admin gán trên hệ thống tổ chức / tài khoản lãnh đạo.'
      : '';

  return {
    answer: [
      'Theo hồ sơ tổ chức của bạn trên hệ thống:',
      '',
      ...contextLines,
      '',
      ...lines,
      missingNote,
      '',
      'Thông tin lấy từ dữ liệu lớp (cố vấn) và tài khoản lãnh đạo đang hoạt động theo khoa/bộ môn.',
    ]
      .filter(Boolean)
      .join('\n'),
    actions: [{ type: 'navigate', page: 'profile', label: 'Hồ sơ cá nhân' }],
    sources: ['db:sinhVien', 'db:lop', 'db:user'],
  };
};

export const ask = async ({ message, user }) => {
  const text = String(message || '').trim();
  if (text.length < 2) {
    return {
      intent: 'fallback',
      confidence: 0,
      answer:
        'Bạn hãy nhập câu hỏi (ví dụ: cố vấn lớp tôi là ai?, em muốn bảo lưu thì làm đơn nào?, cấp lại thẻ cần gì?).',
      actions: [],
      suggestions: [
        'Có những đơn nào trên hệ thống?',
        'Em muốn tạm nghỉ học thì làm đơn nào?',
        'Bảo lưu khác thôi học thế nào?',
        'Mất thẻ SV làm đơn nào?',
      ],
    };
  }

  const ctx = await loadRuntimeContext();
  const detected = detectIntent(text, ctx.needKeywords);
  const { intentId, confidence } = detected;
  const normalized = detected.normalized || stripDiacritics(text);

  if (intentId === 'compare_procedures' || (findCompare(normalized) && !/(muon|lam don nao|nop don)/.test(normalized))) {
    const result = await compareProceduresAnswer(text, ctx);
    return { intent: 'compare_procedures', confidence: Math.max(confidence, 0.85), ...result };
  }

  if (
    (intentId === 'org_leadership' || matchesLeadershipQuestion(text)) &&
    // Câu "trưởng khoa của tôi" vẫn ưu tiên my_faculty_dean
    !/(cua )?toi|cua em/.test(normalized)
  ) {
    const result = await lookupLeadership(text, { portal: 'student' });
    if (result) {
      return { intent: 'org_leadership', confidence: Math.max(confidence, 0.9), ...result };
    }
  }

  const retake = clarifyRetakeCourse(normalized);
  if (retake && /(thi rot|hoc lai mon)/.test(normalized) && !/(bao luu|tam nghi)/.test(normalized)) {
    return { intent: 'explain_procedure', confidence: 0.9, ...retake };
  }

  if (
    intentId === 'workflow_steps' ||
    /(cac buoc|buoc quy trinh|quy trinh (cua |don )|ai duyet don|co may buoc)/.test(normalized)
  ) {
    const result = await getFormWorkflowSteps(text, { portal: 'student' });
    return { intent: 'workflow_steps', confidence: Math.max(confidence, 0.88), ...result };
  }

  const runtimeHit = findRuntimeByMessage(ctx.runtimeKb, normalized);
  if (
    intentId === 'explain_procedure' ||
    (runtimeHit &&
      /(la gi|muc dich|dung (de|khi)|ai (duyet|ky)|can gi|phu huynh|huong dan)/.test(normalized))
  ) {
    const result = await explainProcedure(text, ctx);
    return { intent: 'explain_procedure', confidence: Math.max(confidence, 0.85), ...result };
  }

  if (intentId === 'recommend_procedure') {
    const result = await recommendProcedures(text, ctx);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'list_procedures') {
    const result = await listActiveProcedures(ctx);
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'my_advisor') {
    const result = await lookupMyStaff(user, 'advisor');
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'my_faculty_dean') {
    const result = await lookupMyStaff(user, 'faculty');
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'my_department_chair') {
    const result = await lookupMyStaff(user, 'department');
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'my_org_contacts') {
    const result = await lookupMyStaff(user, 'all');
    return { intent: intentId, confidence, ...result };
  }

  if (intentId === 'my_submissions' || intentId === 'navigate_my_forms') {
    const result = await listMySubmissions(user);
    return { intent: intentId, confidence, ...result };
  }

  const faq = faqForIntent(intentId);
  if (faq) {
    return {
      intent: intentId,
      confidence,
      answer: faq.answer,
      actions: faq.actions || [],
      sources: ['faq'],
    };
  }

  if (runtimeHit) {
    const result = await explainProcedure(text, ctx);
    return { intent: 'explain_procedure', confidence: 0.7, ...result };
  }

  const maybeNeed = ctx.needKeywords.some((n) =>
    n.keys.some((k) => normalized.includes(stripDiacritics(k))),
  );
  if (maybeNeed) {
    const result = await recommendProcedures(text, ctx);
    return { intent: 'recommend_procedure', confidence: 0.55, ...result };
  }

  return {
    intent: 'fallback',
    confidence,
    answer: [
      'Em chưa khớp câu hỏi với chủ đề hỗ trợ hiện có.',
      'Bạn có thể hỏi về các thủ tục đang mở trên cổng (tự cập nhật khi có đơn mới), cố vấn/trưởng khoa, nộp/rút đơn, trạng thái hồ sơ.',
      'Ví dụ: có những đơn nào?, [tên đơn] là gì?, em muốn … thì làm đơn nào?',
    ].join(' '),
    actions: [
      { type: 'navigate', page: 'home', label: 'Trang chủ thủ tục' },
      { type: 'navigate', page: 'faq', label: 'Xem FAQ' },
      { type: 'navigate', page: 'search', label: 'Hồ sơ của tôi' },
    ],
    suggestions: [
      'Có những đơn nào?',
      'Em muốn bảo lưu thì làm đơn nào?',
      'Bảo lưu khác thôi học thế nào?',
      'Cấp lại thẻ sinh viên cần gì?',
    ],
    sources: [],
  };
};

export const getSuggestions = () => [
  'Có những đơn nào trên hệ thống?',
  'Các bước quy trình đơn thôi học',
  'Em muốn tạm nghỉ học thì làm đơn nào?',
  'Bảo lưu khác thôi học thế nào?',
  'Mất thẻ SV làm đơn nào?',
  'Giấy giới thiệu thực tập là gì?',
];
