import crypto from 'crypto';
import fs from 'fs';
import axios from 'axios';
import mammoth from 'mammoth';
import LoaiDon from '../importForms/LoaiDon.model.js';
import { Workflow } from '../workflows/workflow.model.js';
import { ROLE_LABELS } from '../../config/roles.js';

const strip = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STOP = new Set([
  'em',
  'toi',
  'ban',
  'cua',
  'va',
  'hoac',
  'cho',
  'voi',
  'cac',
  'mot',
  'nhung',
  'trong',
  'theo',
  'duoc',
  'khi',
  'thi',
  'nay',
  'kia',
  'la',
  'de',
  'tu',
  've',
  'tren',
  'duoi',
  'sau',
  'truoc',
  'don',
  'giay',
  'mau',
  'bieu',
  'xin',
  'kinh',
  'gui',
  'cong',
  'hoa',
  'xa',
  'hoi',
  'chu',
  'nghia',
  'viet',
  'nam',
  'doc',
  'lap',
  'tu',
  'do',
  'hanh',
  'phuc',
  'truong',
  'dai',
  'hoc',
  'the',
  'sinh',
  'vien',
  'ho',
  'ten',
  'ngay',
  'thang',
  'nam',
  'mssv',
  'lop',
  'khoa',
]);

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

export const computeSourceHash = (loaiDon = {}) =>
  crypto
    .createHash('sha1')
    .update(
      `v2|${loaiDon.tenDon || ''}|${loaiDon.templateFile || ''}|${loaiDon.workflowId || ''}|${loaiDon.description || ''}`,
    )
    .digest('hex');

export const keywordsFromTexts = (...texts) => {
  const joined = strip(texts.filter(Boolean).join(' '));
  if (!joined) return [];
  const tokens = joined.split(' ').filter((t) => t.length >= 3 && !STOP.has(t));
  const out = new Set();
  for (const t of tokens) out.add(t);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a.length >= 3 && b.length >= 3) out.add(`${a} ${b}`);
  }
  // Cụm tên đầy đủ (rút gọn)
  if (joined.length >= 6 && joined.length <= 80) out.add(joined);
  return [...out].slice(0, 48);
};

export const purposeFromRawText = (raw = '', tenDon = '') => {
  const cleaned = String(raw || '')
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return tenDon ? `Thủ tục ${tenDon} đang mở trên cổng dịch vụ công.` : '';
  }

  const sentences = cleaned
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 280);

  const ten = strip(tenDon);
  const preferred =
    sentences.find((s) => {
      const n = strip(s);
      return (
        (ten && n.includes(ten)) ||
        /muc dich|dung de|xin |de nghi|yeu cau|thu tuc|don xin|giay/.test(n)
      );
    }) ||
    sentences[0] ||
    cleaned.slice(0, 220);

  return preferred.trim();
};

const loadTemplateBuffer = async (templateFile) => {
  if (!templateFile) return null;
  if (isRemoteUrl(templateFile)) {
    const response = await axios.get(templateFile, {
      responseType: 'arraybuffer',
      timeout: 45000,
    });
    return Buffer.from(response.data);
  }
  if (fs.existsSync(templateFile)) {
    return fs.promises.readFile(templateFile);
  }
  return null;
};

export const extractDocPlainText = async (templateFile, buffer) => {
  try {
    const buf = buffer || (await loadTemplateBuffer(templateFile));
    if (!buf) return '';
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || '';
  } catch {
    return '';
  }
};

/**
 * Lập chỉ mục chatbot tự động từ LoaiDon (không cần admin cấu hình).
 * @param {object} loaiDon
 * @param {{ buffer?: Buffer }} [opts]
 */
export const buildChatbotIndex = async (loaiDon, opts = {}) => {
  const rawText = await extractDocPlainText(loaiDon.templateFile, opts.buffer);
  const placeholders = (loaiDon.chiTiet || [])
    .map((c) => c.placeHolder || c.moTa || '')
    .map((x) => String(x).trim())
    .filter(Boolean);

  const keywords = keywordsFromTexts(
    loaiDon.tenDon,
    loaiDon.description,
    placeholders.join(' '),
    rawText.slice(0, 2500),
  );

  let whoApproves = [];
  const workflowId = loaiDon.workflowId;
  if (workflowId) {
    const wf = await Workflow.findById(workflowId).select('steps').lean();
    whoApproves = (wf?.steps || [])
      .map((s) => {
        const roleLabel = s.role ? ROLE_LABELS[s.role] || s.role : '';
        return s.stepName || roleLabel || '';
      })
      .filter(Boolean);
  }

  const blob = strip(`${rawText} ${placeholders.join(' ')}`);
  const needParentSignature = /phu huynh|chu ky ph|y kien gia dinh|xac nhan cua ph/.test(blob);

  const purposeSnippet =
    (loaiDon.description && String(loaiDon.description).trim()) ||
    purposeFromRawText(rawText, loaiDon.tenDon);

  return {
    keywords,
    purposeSnippet,
    fieldHints: placeholders.slice(0, 16),
    whoApproves,
    needParentSignature,
    indexedAt: new Date(),
    sourceHash: computeSourceHash(loaiDon),
  };
};

/** Đảm bảo một LoaiDon đã có chatbotIndex khớp source hiện tại */
export const ensureLoaiDonIndexed = async (loaiDon) => {
  if (!loaiDon?._id) return loaiDon;
  const plain = typeof loaiDon.toObject === 'function' ? loaiDon.toObject() : { ...loaiDon };
  const hash = computeSourceHash(plain);
  if (plain.chatbotIndex?.sourceHash === hash && plain.chatbotIndex?.keywords?.length) {
    return plain;
  }

  const index = await buildChatbotIndex(plain);
  await LoaiDon.updateOne({ _id: plain._id }, { $set: { chatbotIndex: index } });
  return { ...plain, chatbotIndex: index };
};

/** Index mọi đơn đang active (lazy, bỏ qua nếu đã khớp hash) */
export const ensureActiveFormsIndexed = async () => {
  const forms = await LoaiDon.find({ isActive: { $ne: false } }).lean();
  const out = [];
  for (const form of forms) {
    // eslint-disable-next-line no-await-in-loop
    out.push(await ensureLoaiDonIndexed(form));
  }
  return out;
};
