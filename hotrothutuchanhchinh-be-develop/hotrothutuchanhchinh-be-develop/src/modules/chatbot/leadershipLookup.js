import User from '../users/user.model.js';
import Khoa from '../organization/models/khoa.model.js';
import BoMon from '../organization/models/boMon.model.js';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';

const strip = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatLeader = (u) => {
  if (!u) return null;
  const bits = [`**${u.fullName}**`];
  bits.push(ROLE_LABELS[u.role] || u.role);
  if (u.email) bits.push(u.email);
  if (u.phone) bits.push(`ĐT: ${u.phone}`);
  if (u.khoaId?.name || u.khoaId?.code) {
    bits.push(`Khoa: ${u.khoaId.name || u.khoaId.code}`);
  }
  if (u.boMonId?.name || u.boMonId?.code) {
    bits.push(`BM: ${u.boMonId.name || u.boMonId.code}`);
  }
  if (u.isActive === false) bits.push('Ngừng hoạt động');
  return bits.join(' · ');
};

const findKhoaFromMessage = async (normalized) => {
  const khoas = await Khoa.find({ isActive: { $ne: false } }).select('code name').lean();
  let best = null;
  let bestScore = 0;
  for (const k of khoas) {
    const code = strip(k.code);
    const name = strip(k.name);
    let score = 0;
    if (code && normalized.includes(code.toLowerCase())) score += 20;
    // token overlap on name (cntt, cong nghe thong tin, …)
    const nameTokens = name.split(' ').filter((t) => t.length >= 3);
    const hits = nameTokens.filter((t) => normalized.includes(t)).length;
    score += hits * 3;
    // common aliases
    if ((code === 'cntt' || name.includes('cong nghe thong tin')) && /cntt|cong nghe thong tin|tin hoc/.test(normalized)) {
      score += 15;
    }
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return bestScore >= 6 ? best : null;
};

const findBoMonFromMessage = async (normalized, khoaId = null) => {
  const filter = { isActive: { $ne: false } };
  if (khoaId) filter.khoaId = khoaId;
  const list = await BoMon.find(filter).select('code name khoaId').lean();
  let best = null;
  let bestScore = 0;
  for (const b of list) {
    const code = strip(b.code);
    const name = strip(b.name);
    let score = 0;
    if (code && normalized.includes(code)) score += 18;
    const tokens = name.split(' ').filter((t) => t.length >= 3);
    score += tokens.filter((t) => normalized.includes(t)).length * 3;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return bestScore >= 6 ? best : null;
};

const loadLeaders = async (role, extraFilter = {}) =>
  User.find({ role, isActive: { $ne: false }, ...extraFilter })
    .select('fullName email phone role isActive khoaId boMonId')
    .populate('khoaId', 'code name')
    .populate('boMonId', 'code name')
    .sort({ fullName: 1 })
    .lean();

/**
 * Tra cứu lãnh đạo theo câu hỏi: hiệu trưởng, trưởng khoa (CNTT…), trưởng bộ môn…
 */
export const lookupLeadership = async (message = '', options = {}) => {
  const portal = options.portal === 'student' ? 'student' : 'admin';
  const normalized = strip(message);

  const wantPrincipal = /hieu truong|ban giam hieu|hieu pho|pho hieu/.test(normalized);
  const wantFaculty =
    /truong khoa|pho truong khoa|lanh dao khoa|chu nhiem khoa|ban chu nhiem khoa/.test(normalized);
  const wantDept = /truong bo mon|pho truong bo mon|lanh dao bo mon/.test(normalized);
  const wantAllLeaders = /danh sach (lanh dao|can bo lanh dao)|cac (hieu truong|truong khoa)/.test(
    normalized,
  );

  // Không khớp rõ → vẫn thử nếu có "ten gi" + chức vụ ngắn
  const softFaculty = !wantFaculty && /khoa/.test(normalized) && /(ten|ai la|la ai)/.test(normalized);
  const softPrincipal = !wantPrincipal && /hieu/.test(normalized) && /(ten|ai la|la ai)/.test(normalized);

  const isFaculty = wantFaculty || softFaculty;
  const isPrincipal = wantPrincipal || softPrincipal;
  const isDept = wantDept;

  if (!isFaculty && !isPrincipal && !isDept && !wantAllLeaders) {
    return null;
  }

  const lines = [];
  const actions =
    portal === 'admin'
      ? [{ type: 'navigate', path: '/users', label: 'Mở Quản lý người dùng' }]
      : [{ type: 'navigate', page: 'home', label: 'Trang chủ thủ tục' }];

  if (isPrincipal || wantAllLeaders) {
    const [principals, vices] = await Promise.all([
      loadLeaders(ROLES.PRINCIPAL),
      loadLeaders(ROLES.VICE_PRINCIPAL),
    ]);
    lines.push('**Ban giám hiệu**');
    if (principals.length) {
      principals.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
    } else {
      lines.push('- Hiệu trưởng: chưa có tài khoản đang hoạt động trên hệ thống.');
    }
    if (vices.length) {
      lines.push('', 'Phó Hiệu trưởng:');
      vices.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
    } else if (isPrincipal && !wantAllLeaders) {
      lines.push('- Phó Hiệu trưởng: chưa có trên hệ thống.');
    }
  }

  if (isFaculty || wantAllLeaders) {
    const khoa = await findKhoaFromMessage(normalized);
    if (khoa) {
      const [deans, deputies] = await Promise.all([
        loadLeaders(ROLES.FACULTY_MANAGER, { khoaId: khoa._id }),
        loadLeaders(ROLES.DEPUTY_FACULTY_MANAGER, { khoaId: khoa._id }),
      ]);
      lines.push(
        lines.length ? '' : null,
        `**Lãnh đạo khoa ${khoa.name} (${khoa.code})**`,
      );
      if (deans.length) deans.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      else lines.push('- Trưởng khoa: chưa gán tài khoản (role Trưởng khoa + khoaId).');
      if (deputies.length) {
        lines.push('Phó Trưởng khoa:');
        deputies.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      }
      if (portal === 'admin') {
        actions.push({
          type: 'navigate',
          path: '/organization/khoa-bo-mon',
          label: 'Mở Khoa & Bộ môn',
        });
      }
    } else if (isFaculty && !wantAllLeaders) {
      // Liệt kê tất cả trưởng khoa
      const [deans, deputies] = await Promise.all([
        loadLeaders(ROLES.FACULTY_MANAGER),
        loadLeaders(ROLES.DEPUTY_FACULTY_MANAGER),
      ]);
      lines.push(lines.length ? '' : null, '**Các Trưởng khoa đang có trên hệ thống**');
      if (deans.length) deans.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      else lines.push('- Chưa có tài khoản Trưởng khoa.');
      if (deputies.length) {
        lines.push('', 'Phó Trưởng khoa:');
        deputies.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      }
      lines.push(
        '',
        'Gợi ý: hỏi cụ thể hơn, ví dụ: trưởng khoa CNTT tên gì?',
      );
    } else if (wantAllLeaders) {
      const deans = await loadLeaders(ROLES.FACULTY_MANAGER);
      lines.push(lines.length ? '' : null, '**Các Trưởng khoa**');
      if (deans.length) deans.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      else lines.push('- Chưa có.');
    }
  }

  if (isDept) {
    const khoa = await findKhoaFromMessage(normalized);
    const boMon = await findBoMonFromMessage(normalized, khoa?._id || null);
    if (boMon) {
      const [chairs, deputies] = await Promise.all([
        loadLeaders(ROLES.DEPARTMENT_CHAIR, { boMonId: boMon._id }),
        loadLeaders(ROLES.DEPUTY_DEPARTMENT_CHAIR, { boMonId: boMon._id }),
      ]);
      lines.push(
        lines.length ? '' : null,
        `**Lãnh đạo bộ môn ${boMon.name} (${boMon.code})**`,
      );
      if (chairs.length) chairs.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      else lines.push('- Trưởng bộ môn: chưa gán.');
      if (deputies.length) {
        lines.push('Phó Trưởng bộ môn:');
        deputies.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      }
    } else {
      const chairs = await loadLeaders(ROLES.DEPARTMENT_CHAIR);
      lines.push(lines.length ? '' : null, '**Các Trưởng bộ môn**');
      if (chairs.length) chairs.forEach((u, i) => lines.push(`${i + 1}. ${formatLeader(u)}`));
      else lines.push('- Chưa có tài khoản Trưởng bộ môn.');
      lines.push('', 'Gợi ý: nêu rõ tên/mã bộ môn.');
    }
  }

  const answer = [
    ...lines.filter((x) => x != null),
    '',
    'Dữ liệu lấy từ tài khoản User đang hoạt động (role + khoa/bộ môn). Nếu trống, Admin cần gán đúng role và khoaId/boMonId.',
  ].join('\n');

  return {
    answer,
    actions,
    sources: ['db:user', 'db:khoa', 'db:boMon'],
  };
};

/** true nếu câu hỏi mang tính hỏi lãnh đạo / chức danh */
export const matchesLeadershipQuestion = (message = '') => {
  const n = strip(message);
  if (
    /hieu truong|pho hieu|ban giam hieu|truong khoa|pho truong khoa|truong bo mon|pho truong bo mon|lanh dao khoa|lanh dao bo mon|chu nhiem khoa/.test(
      n,
    )
  ) {
    return true;
  }
  return /(ten gi|ai la|la ai)/.test(n) && /(hieu truong|truong khoa|pho truong|bo mon|ban giam)/.test(n);
};
