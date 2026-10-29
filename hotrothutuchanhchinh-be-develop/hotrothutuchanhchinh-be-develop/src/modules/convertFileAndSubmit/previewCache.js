import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const TEMPLATE_TTL_MS = 20 * 60 * 1000;
const templateCache = new Map();

const pruneTemplateCache = () => {
  const now = Date.now();
  for (const [key, entry] of templateCache.entries()) {
    if (entry.expiresAt <= now) templateCache.delete(key);
  }
};

/** Tải mẫu DOCX (cache in-memory theo URL). Luôn trả bản copy để không làm hỏng cache. */
export const getTemplateBuffer = async (templateUrl) => {
  pruneTemplateCache();
  const cached = templateCache.get(templateUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return Buffer.from(cached.buffer);
  }

  const response = await axios.get(templateUrl, { responseType: 'arraybuffer', timeout: 60000 });
  const buffer = Buffer.from(response.data);
  templateCache.set(templateUrl, {
    buffer,
    expiresAt: Date.now() + TEMPLATE_TTL_MS,
  });
  return Buffer.from(buffer);
};

const PREVIEW_TTL_MS = 20 * 60 * 1000;
const previewCache = new Map();

const prunePreviewCache = () => {
  const now = Date.now();
  for (const [id, entry] of previewCache.entries()) {
    if (entry.expiresAt <= now) {
      if (entry.pdfPath) {
        fs.promises.unlink(entry.pdfPath).catch(() => {});
      }
      previewCache.delete(id);
    }
  }
};

/** Hash ổn định từ fields text + nội dung ảnh chữ ký (nếu có path local). */
export const buildContentHash = async (fields = {}, options = {}) => {
  const { loaiDonId = '', templateUrl = '' } = options;
  const skipKeys = new Set(['url', 'templateFile', 'loaiDonId', 'previewId', 'signature']);
  const parts = [`loaiDonId:${loaiDonId}`, `template:${templateUrl}`];

  const keys = Object.keys(fields)
    .filter((key) => !skipKeys.has(key))
    .sort();

  for (const key of keys) {
    const value = fields[key];
    if (value == null || value === '') {
      parts.push(`${key}=`);
      continue;
    }
    if (typeof value === 'string' && (value.includes(path.sep) || value.startsWith('/tmp') || fs.existsSync(value))) {
      try {
        if (fs.existsSync(value) && fs.statSync(value).isFile()) {
          const fileBuf = await fs.promises.readFile(value);
          parts.push(`${key}:file:${crypto.createHash('sha256').update(fileBuf).digest('hex')}`);
          continue;
        }
      } catch {
        // fall through to string hash
      }
    }
    if (typeof value === 'object') {
      parts.push(`${key}:${JSON.stringify(value)}`);
    } else {
      parts.push(`${key}:${String(value)}`);
    }
  }

  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
};

export const storePreviewPdf = async ({
  pdfBuffer,
  contentHash,
  loaiDonId,
  userId,
  templateUrl,
}) => {
  prunePreviewCache();
  const previewId = crypto.randomBytes(16).toString('hex');
  const tempDir = path.join(process.cwd(), 'temp', 'preview-cache');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const pdfPath = path.join(tempDir, `${previewId}.pdf`);
  await fs.promises.writeFile(pdfPath, pdfBuffer);

  previewCache.set(previewId, {
    pdfPath,
    contentHash,
    loaiDonId: loaiDonId ? String(loaiDonId) : '',
    userId: userId ? String(userId) : '',
    templateUrl: templateUrl || '',
    expiresAt: Date.now() + PREVIEW_TTL_MS,
  });

  return previewId;
};

export const takePreviewPdfIfMatch = async ({
  previewId,
  contentHash,
  loaiDonId,
  userId,
  templateUrl,
}) => {
  if (!previewId) return null;
  prunePreviewCache();
  const entry = previewCache.get(previewId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    previewCache.delete(previewId);
    return null;
  }
  if (entry.contentHash !== contentHash) return null;
  if (loaiDonId && entry.loaiDonId && entry.loaiDonId !== String(loaiDonId)) return null;
  if (templateUrl && entry.templateUrl && entry.templateUrl !== templateUrl) return null;
  if (userId && entry.userId && entry.userId !== String(userId)) return null;

  try {
    const pdfBuffer = await fs.promises.readFile(entry.pdfPath);
    // Keep cache entry for a short window in case of retry; still valid until TTL.
    return pdfBuffer;
  } catch {
    previewCache.delete(previewId);
    return null;
  }
};
