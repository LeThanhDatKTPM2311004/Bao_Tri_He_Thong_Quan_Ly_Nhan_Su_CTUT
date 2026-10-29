/**
 * Chuẩn bị caption họ tên dưới chữ ký SV/PH và giữ dòng ngày làm đơn một hàng.
 */
import PizZip from 'pizzip';

const IMG_TO_CAPTION = {
  CHU_KY_SV: 'TEN_KY_SV',
  CHU_KY_PH: 'TEN_KY_PH',
};

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const cellPlainText = (cellXml) =>
  [...cellXml.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const CENTERED_PPR =
  `<w:pPr>` +
  `<w:jc w:val="center"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `<w:spacing w:before="40" w:after="0"/>` +
  `</w:pPr>`;

const buildCaptionParagraph = (name) => {
  const caption = String(name || '').trim();
  if (!caption) return '';
  return (
    `<w:p>` +
    CENTERED_PPR +
    `<w:r>` +
    `<w:rPr>` +
    `<w:rFonts w:ascii="Liberation Serif" w:hAnsi="Liberation Serif" w:cs="Liberation Serif" w:eastAsia="Liberation Serif"/>` +
    `<w:b/><w:sz w:val="20"/><w:szCs w:val="20"/>` +
    `</w:rPr>` +
    `<w:t xml:space="preserve">${escapeXml(caption)}</w:t>` +
    `</w:r></w:p>`
  );
};

/** Ép đoạn trong ô chữ ký canh giữa, bỏ thụt lề để thẳng hàng với tiêu đề cột. */
const forceParagraphCenterNoIndent = (paragraph) => {
  if (/<w:pPr\b[\s\S]*?<\/w:pPr>/.test(paragraph)) {
    return paragraph.replace(/<w:pPr\b[\s\S]*?<\/w:pPr>/, (pPr) => {
      let next = pPr.replace(/<w:ind\b[^/]*\/>/g, '').replace(/<w:ind\b[\s\S]*?<\/w:ind>/g, '');
      if (/<w:jc\b/.test(next)) {
        next = next.replace(/<w:jc\b[^/]*\/>/g, '<w:jc w:val="center"/>');
      } else {
        next = next.replace(/<\/w:pPr>/, '<w:jc w:val="center"/><w:ind w:left="0" w:right="0" w:firstLine="0"/></w:pPr>');
      }
      if (!/<w:ind\b/.test(next)) {
        next = next.replace(/<\/w:pPr>/, '<w:ind w:left="0" w:right="0" w:firstLine="0"/></w:pPr>');
      }
      return next;
    });
  }

  return paragraph.replace(/^<w:p\b([^>]*)>/, `<w:p$1>${CENTERED_PPR}`);
};

const isSignerTitleParagraph = (paragraph) => {
  const text = cellPlainText(paragraph);
  return /Ý\s*kiến\s*của\s*phụ\s*huynh|Người\s*làm\s*đơn/i.test(text);
};

/**
 * Canh giữa ảnh chữ ký + họ tên + tiêu đề trong ô "phụ huynh" / "Người làm đơn".
 */
export const centerSignerNameAndSignature = (docxBuffer) => {
  const zip = new PizZip(docxBuffer);
  let touched = false;

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue;
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;

    let xml = entry.asText();
    const before = xml;

    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
      const text = cellPlainText(cell);
      const isSignerCell =
        /phụ\s*huynh|Người\s*làm\s*đơn/i.test(text) || cell.includes('w:drawing');
      if (!isSignerCell) return cell;

      return cell.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
        const shouldCenter =
          paragraph.includes('w:drawing') ||
          isSignerTitleParagraph(paragraph) ||
          // Đoạn caption họ tên ngay dưới ảnh (đậm, không phải ngày tháng)
          (/<w:b\b/.test(paragraph) &&
            !/Cần\s*Thơ|ngày|tháng|năm|Số\s*điện\s*thoại/i.test(cellPlainText(paragraph)) &&
            cellPlainText(paragraph).length > 0 &&
            cellPlainText(paragraph).length < 80);

        return shouldCenter ? forceParagraphCenterNoIndent(paragraph) : paragraph;
      });
    });

    if (xml !== before) {
      zip.file(name, xml);
      touched = true;
    }
  }

  if (!touched) return docxBuffer;
  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
};

const resolveCaptionForCell = (cellText, fields) => {
  if (/phụ\s*huynh/i.test(cellText)) return String(fields.TEN_KY_PH || '').trim();
  if (/Người\s*làm\s*đơn/i.test(cellText)) return String(fields.TEN_KY_SV || '').trim();
  return '';
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text) return text;
  }
  return '';
};

/** Gán TEN_KY_SV / TEN_KY_PH từ form + user đăng nhập. */
export const assignSignatureCaptionFields = (fields = {}, req = {}) => {
  const studentName = firstNonEmpty(
    fields.TEN_KY_SV,
    fields.HO_TEN,
    fields.HO_VA_TEN,
    fields.TEN_SINH_VIEN,
    fields.HOTEN,
    fields.FULL_NAME,
    req.user?.fullName,
  );

  const parentName = firstNonEmpty(
    fields.TEN_KY_PH,
    fields.TEN_PHU_HUYNH,
    fields.HO_TEN_PHU_HUYNH,
    fields.HO_TEN_CHA,
    fields.TEN_CHA,
    fields.HO_TEN_ME,
    fields.TEN_ME,
    fields.HO_TEN_NGUOI_GIAM_HO,
    fields.TEN_NGUOI_GIAM_HO,
  );

  if (studentName) fields.TEN_KY_SV = studentName;
  else if (!fields.TEN_KY_SV) fields.TEN_KY_SV = '';

  if (parentName) fields.TEN_KY_PH = parentName;
  else if (!fields.TEN_KY_PH) fields.TEN_KY_PH = '';

  // Dồn ngày/tháng/năm thành chuỗi gắn NBSP — tránh LibreOffice tách "năm" / "2026".
  const stripLeadZero = (value) =>
    String(value || '')
      .replace(/^\u00A0+/, '')
      .trim()
      .replace(/^0+(\d+)$/, '$1');

  const day = stripLeadZero(fields.NGAY_LAM_DON);
  const month = stripLeadZero(fields.THANG_LAM_DON);
  const year = String(fields.NAM_LAM_DON ?? '')
    .replace(/^\u00A0+/, '')
    .trim();
  if (day) fields.NGAY_LAM_DON = day;
  if (month) fields.THANG_LAM_DON = month;
  if (year) fields.NAM_LAM_DON = year;
  if (day && month && year) {
    fields.NGAY_THANG_NAM_LAM_DON = `${day} tháng ${month} năm ${year}`;
  }

  return fields;
};

/**
 * Chèn {TEN_KY_SV}/{TEN_KY_PH} ngay dưới {%CHU_KY_SV}/{%CHU_KY_PH} trong mẫu Word
 * để họ tên hiện dưới ảnh chữ ký sau khi render.
 */
export const injectSignatureCaptionPlaceholders = (docxBuffer) => {
  const zip = new PizZip(docxBuffer);
  let touched = false;

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue;
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;

    let xml = entry.asText();
    let changed = false;

    for (const [imgTag, captionTag] of Object.entries(IMG_TO_CAPTION)) {
      const needle = `{%${imgTag}}`;
      if (!xml.includes(needle)) continue;

      // Đã inject rồi (caption ngay sau image tag trong ~400 ký tự)
      const already = new RegExp(
        `\\{%${imgTag}\\}[\\s\\S]{0,400}\\{${captionTag}\\}`,
      );
      if (already.test(xml)) continue;

      const replacement =
        `{%${imgTag}}</w:t></w:r></w:p>` +
        `<w:p>` +
        CENTERED_PPR +
        `<w:r>` +
        `<w:rPr>` +
        `<w:rFonts w:ascii="Liberation Serif" w:hAnsi="Liberation Serif" w:cs="Liberation Serif" w:eastAsia="Liberation Serif"/>` +
        `<w:b/>` +
        `<w:sz w:val="20"/>` +
        `<w:szCs w:val="20"/>` +
        `</w:rPr>` +
        `<w:t>{${captionTag}}`;

      xml = xml.split(needle).join(replacement);
      changed = true;
    }

    if (changed) {
      zip.file(name, xml);
      touched = true;
    }
  }

  if (!touched) return docxBuffer;
  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
};

/**
 * Sau khi render docxtemplater: chèn họ tên dưới ảnh chữ ký theo nhãn ô bảng
 * (dự phòng khi inject trước render không chạy hoặc mẫu Word tách placeholder).
 */
export const injectRenderedSignatureCaptions = (docxBuffer, fields = {}) => {
  const studentName = String(fields.TEN_KY_SV || '').trim();
  const parentName = String(fields.TEN_KY_PH || '').trim();
  if (!studentName && !parentName) {
    return centerSignerNameAndSignature(docxBuffer);
  }

  const zip = new PizZip(docxBuffer);
  let touched = false;

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue;
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;

    let xml = entry.asText();
    const before = xml;

    xml = xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
      if (!cell.includes('w:drawing')) return cell;

      const caption = resolveCaptionForCell(cellPlainText(cell), fields);
      if (!caption || cell.includes(`>${caption}<`) || cell.includes(`>${caption}</w:t>`)) {
        return cell;
      }

      const updated = cell.replace(
        /(<w:p\b[\s\S]*?w:drawing[\s\S]*?<\/w:p>)(?![\s\S]*<w:p\b[\s\S]*?w:drawing)/,
        `$1${buildCaptionParagraph(caption)}`,
      );
      return updated;
    });

    if (xml !== before) {
      zip.file(name, xml);
      touched = true;
    }
  }

  const withCaptions = touched
    ? Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }))
    : docxBuffer;
  return centerSignerNameAndSignature(withCaptions);
};

/**
 * Siết khoảng trắng quanh placeholder ngày/tháng/năm trong mẫu Word
 * (trước khi render) để giảm tách dòng.
 */
export const tightenDatePlaceholdersInTemplate = (docxBuffer) => {
  const zip = new PizZip(docxBuffer);
  let touched = false;

  for (const name of Object.keys(zip.files)) {
    if (!name.startsWith('word/') || !name.endsWith('.xml')) continue;
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;

    let xml = entry.asText();
    const before = xml;

    xml = xml
      .replace(/ngày(\s|&nbsp;|&#160;|\u00A0)*\{NGAY_LAM_DON\}/gi, 'ngày\u00A0{NGAY_LAM_DON}')
      .replace(/tháng(\s|&nbsp;|&#160;|\u00A0)*\{THANG_LAM_DON\}/gi, 'tháng\u00A0{THANG_LAM_DON}')
      .replace(/năm(\s|&nbsp;|&#160;|\u00A0)*\{NAM_LAM_DON\}/gi, 'năm\u00A0{NAM_LAM_DON}')
      // Soft break ngay trước năm / placeholder năm
      .replace(/<w:br\b[^/]*\/>\s*(?:<\/w:t>\s*<\/w:r>\s*<w:r\b[^>]*>\s*(?:<w:rPr\b[\s\S]*?<\/w:rPr>\s*)?<w:t\b[^>]*>)?\{NAM_LAM_DON\}/gi, '{NAM_LAM_DON}');

    if (xml !== before) {
      zip.file(name, xml);
      touched = true;
    }
  }

  if (!touched) return docxBuffer;
  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
};
