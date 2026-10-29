import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { isCloudinaryConfigured } from '../../config/cloudinary.js';
import { readStoredFileBuffer, uploadPrivateRawFile } from '../../shared/storage/privateRawStorage.js';
import config from '../../config/index.js';
import { ValidationError } from '../../shared/errors/AppError.js';
import { convertDocxBufferToPdf } from '../convertFileAndSubmit/pdfConvert.js';

const UNICODE_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\arial.ttf',
  'C:\\Windows\\Fonts\\tahoma.ttf',
  'C:\\Windows\\Fonts\\times.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
  '/System/Library/Fonts/Supplemental/Times New Roman.ttf',
];

const BOLD_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\arialbd.ttf',
  'C:\\Windows\\Fonts\\tahomabd.ttf',
  'C:\\Windows\\Fonts\\timesbd.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
];

const ITALIC_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\timesi.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf',
  '/System/Library/Fonts/Supplemental/Times New Roman Italic.ttf',
];

const embedFontFromCandidates = async (pdfDoc, candidates) => {
  for (const fontPath of candidates) {
    try {
      const bytes = await fs.readFile(fontPath);
      return pdfDoc.embedFont(bytes, { subset: true });
    } catch {
      // try next candidate
    }
  }
  return null;
};

const loadUnicodeFont = async (pdfDoc) => {
  pdfDoc.registerFontkit(fontkit);
  return (
    (await embedFontFromCandidates(pdfDoc, UNICODE_FONT_CANDIDATES)) ||
    pdfDoc.embedFont(StandardFonts.Helvetica)
  );
};

const loadBoldFont = async (pdfDoc, fallback) => {
  const embedded = await embedFontFromCandidates(pdfDoc, BOLD_FONT_CANDIDATES);
  if (embedded) return embedded;
  try {
    return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  } catch {
    return fallback;
  }
};

const loadItalicFont = async (pdfDoc, fallback) => {
  const embedded = await embedFontFromCandidates(pdfDoc, ITALIC_FONT_CANDIDATES);
  if (embedded) return embedded;
  try {
    return await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  } catch {
    return fallback;
  }
};

export const formatCanThoSignDate = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  return `Cần Thơ, ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
};

/** Timestamp trong khung chữ ký — khớp mẫu SmartCA: `14/08/2026 15:45:36 GMT+7` */
export const formatStampSignedAt = (value = new Date()) => {
  const d = value instanceof Date ? value : new Date(value);
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}:${get('second')} GMT+7`;
};

export const officialSignTitleLines = (role, stepName = '') => {
  const byRole = {
    vice_principal: ['KT. HIỆU TRƯỞNG', 'PHÓ HIỆU TRƯỞNG'],
    principal: ['HIỆU TRƯỞNG'],
    faculty_manager: ['TRƯỞNG KHOA'],
    deputy_faculty_manager: ['KT. TRƯỞNG KHOA', 'PHÓ TRƯỞNG KHOA'],
    department_chair: ['TRƯỞNG BỘ MÔN'],
    deputy_department_chair: ['KT. TRƯỞNG BỘ MÔN', 'PHÓ TRƯỞNG BỘ MÔN'],
    department_head: ['TRƯỞNG PHÒNG'],
    deputy_department_head: ['KT. TRƯỞNG PHÒNG', 'PHÓ TRƯỞNG PHÒNG'],
    center_director: ['GIÁM ĐỐC'],
    deputy_center_director: ['KT. GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC'],
    academic_advisor: ['CỐ VẤN HỌC TẬP'],
  };
  if (byRole[role]) return byRole[role];
  const label = String(stepName || '').trim();
  return label ? [label.toUpperCase()] : [];
};

/** Bỏ dấu tiếng Việt khi không nhúng được font Unicode */
const toAsciiFallback = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const loadBytes = async (source) => readStoredFileBuffer(source);

/** Xuất để các module khác (CA) hash đúng nội dung PDF trước khi ký. */
export const loadSourceBytes = loadBytes;

const loadImageBytes = async (imageUrl) => {
  if (!imageUrl) return null;
  try {
    if (String(imageUrl).startsWith('data:image/')) {
      const base64 = String(imageUrl).split(',')[1];
      if (!base64) return null;
      return Buffer.from(base64, 'base64');
    }
    return await loadBytes(imageUrl);
  } catch {
    return null;
  }
};

const ensureSignaturesDir = async () => {
  const dir = path.resolve(process.cwd(), config.upload.dir || './uploads', 'signatures');
  await fs.mkdir(dir, { recursive: true });
  return dir;
};

const uploadSignedPdf = async (pdfBytes, fileName) => {
  const dir = await ensureSignaturesDir();
  const localPath = path.join(dir, fileName);
  await fs.writeFile(localPath, pdfBytes);

  if (isCloudinaryConfigured()) {
    const result = await uploadPrivateRawFile(localPath, {
      folder: 'pm_tthc/signatures',
      publicId: fileName.replace(/\.[^.]+$/, ''),
      format: 'pdf',
    });
    return result.secure_url;
  }

  return localPath.replace(/\\/g, '/');
};

export { uploadSignedPdf };

const embedSignatureImage = async (pdfDoc, stampImageUrl) => {
  const imageBytes = await loadImageBytes(stampImageUrl);
  if (!imageBytes) return null;
  try {
    return await pdfDoc.embedPng(imageBytes);
  } catch {
    try {
      return await pdfDoc.embedJpg(imageBytes);
    } catch {
      return null;
    }
  }
};

const clamp01 = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, 0), 1);
};

/** Chuẩn hoá placement do người dùng chọn trên FE (gốc toạ độ góc trên-trái, theo tỉ lệ trang) */
const normalizePlacement = (placement) => {
  if (!placement || typeof placement !== 'object') return null;
  const widthRatio = clamp01(placement.widthRatio, 0);
  const heightRatio = clamp01(placement.heightRatio, 0);
  if (widthRatio <= 0 || heightRatio <= 0) return null;
  return {
    page: Math.max(1, Math.floor(Number(placement.page) || 1)),
    xRatio: clamp01(placement.xRatio, 0),
    yRatio: clamp01(placement.yRatio, 0),
    widthRatio,
    heightRatio,
  };
};

const measureTextWidth = (font, text, size) => {
  if (!font || !text) return 0;
  try {
    return font.widthOfTextAtSize(String(text), size);
  } catch {
    return String(text).length * size * 0.5;
  }
};

/** Khối chữ ký trong khung: ảnh → gạch ngang → Ký bởi / Ngày ký (mẫu SmartCA). */
const stampSignatureAtPlacement = async ({
  pdfDoc,
  placement,
  embedded,
  imageOnly = false,
  boxTitle: _boxTitle,
  titleLines: _titleLines = [],
  signerName,
  signedAt,
  drawSafeTextOnPage,
}) => {
  const pages = pdfDoc.getPages();
  if (!pages.length) return false;
  const pageIndex = Math.min(placement.page - 1, pages.length - 1);
  const targetPage = pages[pageIndex];
  const { width: pw, height: ph } = targetPage.getSize();

  const boxW = placement.widthRatio * pw;
  const boxH = placement.heightRatio * ph;
  const boxLeft = placement.xRatio * pw;
  const boxTop = placement.yRatio * ph;
  const boxBottom = ph - boxTop - boxH;
  const padX = Math.min(Math.max(boxW * 0.04, 3), 8);

  if (imageOnly) {
    if (!embedded) return false;
    const scale = Math.min(boxW / embedded.width, boxH / embedded.height);
    const imgW = embedded.width * scale;
    const imgH = embedded.height * scale;
    targetPage.drawImage(embedded, {
      x: boxLeft + (boxW - imgW) / 2,
      y: boxBottom + (boxH - imgH) / 2,
      width: imgW,
      height: imgH,
    });
    return true;
  }

  const labelColor = rgb(0.55, 0.55, 0.55);
  const valueColor = rgb(0.05, 0.05, 0.05);
  const lineColor = rgb(0.62, 0.62, 0.62);
  const metaRowH = Math.min(Math.max(boxH * 0.13, 11), 16);
  const metaBlockH = metaRowH * 2 + 4;
  const sepGap = Math.min(Math.max(boxH * 0.04, 3), 6);
  const imageAreaH = Math.max(boxH - metaBlockH - sepGap * 2 - 4, boxH * 0.42);
  const fontSize = Math.min(Math.max(metaRowH * 0.72, 7), 10);

  let imageBottom = boxBottom + metaBlockH + sepGap * 2;
  if (embedded) {
    const maxImgW = boxW - padX * 2;
    const scale = Math.min(maxImgW / embedded.width, imageAreaH / embedded.height);
    const imgW = embedded.width * scale;
    const imgH = embedded.height * scale;
    const imgX = boxLeft + (boxW - imgW) / 2;
    const imgY = boxBottom + boxH - imageAreaH + (imageAreaH - imgH) / 2;
    targetPage.drawImage(embedded, { x: imgX, y: imgY, width: imgW, height: imgH });
    imageBottom = imgY;

    // Gạch ngắn dưới ảnh chữ ký
    const underlineW = Math.min(imgW * 0.85, boxW * 0.55);
    const uy = Math.max(imgY - 1.5, boxBottom + metaBlockH + sepGap + 2);
    targetPage.drawLine({
      start: { x: boxLeft + (boxW - underlineW) / 2, y: uy },
      end: { x: boxLeft + (boxW + underlineW) / 2, y: uy },
      thickness: 0.9,
      color: rgb(0.1, 0.1, 0.1),
    });
    imageBottom = uy;
  }

  const sepY = Math.min(imageBottom - sepGap, boxBottom + metaBlockH + sepGap);
  targetPage.drawLine({
    start: { x: boxLeft + padX, y: sepY },
    end: { x: boxLeft + boxW - padX, y: sepY },
    thickness: 0.55,
    color: lineColor,
  });

  const name = String(signerName || '').trim() || '—';
  const when = formatStampSignedAt(signedAt);
  const rows = [
    { label: 'Ký bởi:', value: name },
    { label: 'Ngày ký:', value: when },
  ];

  rows.forEach((row, index) => {
    const rowBottom = boxBottom + (1 - index) * metaRowH + 2;
    const textY = rowBottom + (metaRowH - fontSize) / 2;

    drawSafeTextOnPage(
      targetPage,
      row.label,
      { x: boxLeft + padX, y: textY, size: fontSize, color: labelColor },
      'regular',
    );

    const labelW = measureTextWidth(drawSafeTextOnPage.font, row.label, fontSize);
    const valueFont = drawSafeTextOnPage.boldFont || drawSafeTextOnPage.font;
    const valueWidth = measureTextWidth(valueFont, row.value, fontSize);
    const valueX = Math.max(
      boxLeft + padX + labelW + 4,
      boxLeft + boxW - padX - valueWidth,
    );
    drawSafeTextOnPage(
      targetPage,
      row.value,
      { x: valueX, y: textY, size: fontSize, color: valueColor },
      'bold',
    );
  });

  return true;
};

/** Trang xác nhận riêng ở cuối PDF (bằng chứng ký, dùng khi không chọn vị trí hoặc ký số) */
const appendConfirmationPage = async ({
  pdfDoc,
  isHandwritten,
  imageOnly = false,
  signerName,
  providerLabel,
  hasSignatureImage,
  embedded,
  drawSafeTextOnPage,
  boxTitle: boxTitleOverride,
  pageTitle: pageTitleOverride,
  pageHint: pageHintOverride,
}) => {
  const pageTitle =
    pageTitleOverride ||
    (isHandwritten ? 'TRANG XÁC NHẬN CHỮ KÝ SINH VIÊN' : 'TRANG XÁC NHẬN CHỮ KÝ SỐ');
  const pageHint =
    pageHintOverride ||
    (isHandwritten
      ? 'Tài liệu đã được ký trên hệ thống. Thông tin bên dưới là bằng chứng ký duyệt.'
      : 'Tài liệu đã được ký số điện tử. Thông tin bên dưới là bằng chứng ký duyệt.');
  const boxTitle = boxTitleOverride || (isHandwritten ? 'Chữ ký sinh viên' : 'CHỮ KÝ SỐ');

  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  if (imageOnly) {
    if (embedded) {
      const maxWidth = width - 120;
      const maxHeight = height - 120;
      const scale = Math.min(maxWidth / embedded.width, maxHeight / embedded.height);
      const imgW = embedded.width * scale;
      const imgH = embedded.height * scale;
      page.drawImage(embedded, {
        x: (width - imgW) / 2,
        y: (height - imgH) / 2,
        width: imgW,
        height: imgH,
      });
    }
    return;
  }

  const draw = (text, options) => drawSafeTextOnPage(page, text, options);

  const boxX = 60;
  const boxY = height / 2 - 90;
  const boxW = width - 120;
  const boxH = 200;

  page.drawRectangle({
    x: 36,
    y: 36,
    width: width - 72,
    height: height - 72,
    borderColor: rgb(0.75, 0.8, 0.88),
    borderWidth: 1,
  });

  draw(pageTitle, { x: boxX, y: height - 80, size: 18, color: rgb(0.08, 0.22, 0.5) });
  draw(pageHint, { x: boxX, y: height - 110, size: 11, color: rgb(0.25, 0.25, 0.25) });

  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderColor: rgb(0.12, 0.35, 0.65),
    borderWidth: 2,
    color: rgb(0.95, 0.97, 1),
  });

  draw(boxTitle, { x: boxX + 20, y: boxY + boxH - 28, size: 14, color: rgb(0.1, 0.25, 0.55) });

  const leftPad = 20;
  const leftColW = 200;
  const rightColX = boxX + leftPad + leftColW + 24;
  const contentTop = boxY + boxH - 55;

  if (embedded) {
    const imgW = 180;
    const imgH = Math.min((embedded.height / embedded.width) * imgW, 110);
    page.drawImage(embedded, { x: boxX + leftPad, y: boxY + 28, width: imgW, height: imgH });
  } else if (!hasSignatureImage) {
    draw('(Chưa có ảnh chữ ký)', {
      x: boxX + leftPad,
      y: boxY + 70,
      size: 10,
      color: rgb(0.55, 0.2, 0.2),
    });
  }

  draw('Ký bởi:', { x: rightColX, y: contentTop, size: 10, color: rgb(0.55, 0.55, 0.55) });
  draw(String(signerName || ''), {
    x: rightColX + 52,
    y: contentTop,
    size: 11,
    color: rgb(0.08, 0.08, 0.08),
  });
  draw('Ngày ký:', { x: rightColX, y: contentTop - 20, size: 10, color: rgb(0.55, 0.55, 0.55) });
  draw(formatStampSignedAt(new Date()), {
    x: rightColX + 52,
    y: contentTop - 20,
    size: 10,
    color: rgb(0.08, 0.08, 0.08),
  });

  draw(`Phương thức: ${providerLabel}`, {
    x: rightColX,
    y: boxY + 36,
    size: 9,
    color: rgb(0.45, 0.45, 0.5),
  });
};

const ensurePdfBytes = async (sourceBytes, sourceFileUrl) => {
  if (sourceBytes?.slice(0, 4).toString() === '%PDF') return sourceBytes;
  const lower = String(sourceFileUrl || '').toLowerCase();
  const looksDocx =
    lower.includes('.docx') ||
    (sourceBytes?.length >= 2 && sourceBytes[0] === 0x50 && sourceBytes[1] === 0x4b);
  if (!looksDocx) {
    throw new ValidationError('Hồ sơ không phải PDF/Word nên không ký được lên tờ đơn.');
  }
  const pdf = await convertDocxBufferToPdf(sourceBytes);
  if (pdf && pdf.slice(0, 4).toString() === '%PDF') return pdf;
  throw new ValidationError(
    'Máy local chưa cài LibreOffice nên chưa có PDF để xem/ký. Cài LibreOffice rồi khởi động lại server, hoặc dùng môi trường đã có soffice (Render).',
  );
};

/**
 * Chuẩn bị PDF đã đóng ảnh chữ ký (chưa upload).
 * Dùng chung cho ký tay và bước trước khi nhúng PAdES.
 */
export const prepareStampedPdfDocument = async ({
  sourceFileUrl,
  stampImageUrl,
  signerName,
  providerLabel,
  signatureKind = 'digital',
  imageOnly = false,
  placement: rawPlacement,
  boxTitle: boxTitleOverride,
  titleLines = [],
  signedAt,
}) => {
  const isHandwritten = signatureKind === 'handwritten';
  const sourceBytes = await loadBytes(sourceFileUrl);
  const pdfBytes = await ensurePdfBytes(sourceBytes, sourceFileUrl);
  const sourceDocumentHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

  let pdfDoc;
  try {
    pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  } catch {
    throw new ValidationError('Không đọc được file PDF hồ sơ để đóng chữ ký.');
  }

  let font;
  let italicFont;
  let boldFont;
  let useAscii = false;
  try {
    font = await loadUnicodeFont(pdfDoc);
    italicFont = await loadItalicFont(pdfDoc, font);
    boldFont = await loadBoldFont(pdfDoc, font);
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    useAscii = true;
  }

  const drawSafeTextOnPage = (page, text, { x, y, size, color }, fontKey = 'regular') => {
    const value = useAscii ? toAsciiFallback(text) : String(text || '');
    const chosen =
      fontKey === 'italic'
        ? italicFont || font
        : fontKey === 'bold'
          ? boldFont || font
          : font;
    try {
      page.drawText(value, { x, y, size, font: chosen, color });
    } catch {
      page.drawText(toAsciiFallback(value), { x, y, size, font: chosen, color });
    }
  };
  drawSafeTextOnPage.font = font;
  drawSafeTextOnPage.italicFont = italicFont || font;
  drawSafeTextOnPage.boldFont = boldFont || font;

  const embedded = await embedSignatureImage(pdfDoc, stampImageUrl);
  const placement = normalizePlacement(rawPlacement);
  const boxTitle = boxTitleOverride || '';

  let placedInline = false;
  if (placement) {
    placedInline = await stampSignatureAtPlacement({
      pdfDoc,
      placement,
      embedded,
      imageOnly,
      boxTitle,
      titleLines,
      signerName,
      signedAt,
      drawSafeTextOnPage,
    });
  }

  if (!placedInline) {
    await appendConfirmationPage({
      pdfDoc,
      isHandwritten,
      imageOnly,
      signerName,
      providerLabel,
      hasSignatureImage: Boolean(stampImageUrl),
      embedded,
      drawSafeTextOnPage,
      boxTitle: boxTitle || (isHandwritten ? 'Chữ ký tay' : 'Chữ ký số'),
    });
  }

  return { pdfDoc, sourceDocumentHash, placement, looksLikePdf: true };
};

/**
 * Dán ảnh chữ ký / trang xác nhận rồi upload PDF (không nhúng CMS).
 * - Nếu có `placement`: dán trực tiếp lên vị trí/kích thước người dùng chọn.
 * - Ký số luôn kèm trang xác nhận (bằng chứng chứng thư); ký tay có placement thì không cần.
 * - Nếu file không phải PDF, tạo trang PDF bao bọc thông tin ký.
 */
export const stampAndSaveSignedDocument = async (opts) => {
  const { pdfDoc, sourceDocumentHash } = await prepareStampedPdfDocument(opts);
  const pdfBytes = Buffer.from(await pdfDoc.save());
  const fileName = `signed_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.pdf`;
  const signedFileUrl = await uploadSignedPdf(pdfBytes, fileName);

  return {
    signedFileUrl,
    documentHash: crypto.createHash('sha256').update(pdfBytes).digest('hex'),
    sourceDocumentHash,
    pdfBytes,
  };
};
