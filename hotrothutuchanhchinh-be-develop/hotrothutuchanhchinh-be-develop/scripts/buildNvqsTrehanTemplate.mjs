/**
 * Tạo mẫu Giấy xác nhận tạm hoãn NVQS — trễ hạn (học bổ sung xét TN)
 * từ layout đã chuẩn của Giay_xac_nhan_tam_hoan_NVQS.docx.
 */
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcPath = path.resolve(
  __dirname,
  '../../client/public/mau-word/Giay_xac_nhan_tam_hoan_NVQS.docx',
);
const outPath = path.resolve(
  __dirname,
  '../../client/public/mau-word/Giay_xac_nhan_tam_hoan_NVQS_tre_han.docx',
);

const R_PR =
  '<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman"/><w:b w:val="0"/><w:sz w:val="28"/></w:rPr>';

const pPrBody =
  '<w:pPr><w:spacing w:line="312" w:lineRule="auto"/><w:ind w:left="1" w:hanging="3"/><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>';

const escapeXml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const textRun = (text, { preserve = false } = {}) => {
  const t = escapeXml(text);
  const space = preserve || /^\s|\s$/.test(text) ? ' xml:space="preserve"' : '';
  return `<w:r>${R_PR}<w:t${space}>${t}</w:t></w:r>`;
};

const tabRun = () => `<w:r>${R_PR}<w:tab/></w:r>`;

const placeholderRun = (name) => textRun(`{${name}}`);

/** segments: string | {ph} | {tabs:n} */
const bodyParagraph = (segments) => {
  const runs = [];
  for (const seg of segments) {
    if (typeof seg === 'string') {
      runs.push(textRun(seg, { preserve: true }));
    } else if (seg.ph) {
      runs.push(placeholderRun(seg.ph));
    } else if (seg.tabs) {
      for (let i = 0; i < seg.tabs; i += 1) runs.push(tabRun());
    }
  }
  return `<w:p>${pPrBody}${runs.join('')}</w:p>`;
};

const bodyParagraphs = [
  bodyParagraph(['Sinh viên: ', { ph: 'HO_TEN' }]),
  bodyParagraph(['Ngày, tháng, năm sinh: ', { ph: 'NGAY_SINH' }]),
  bodyParagraph(['Số CMND/CCCD: ', { ph: 'CCCD' }]),
  bodyParagraph(['Nơi cấp: ', { ph: 'NOI_CAP_CCCD' }]),
  bodyParagraph(['Ngành học: ', { ph: 'NGANH' }]),
  bodyParagraph([
    'Mã số sinh viên: ',
    { ph: 'MSSV' },
    { tabs: 2 },
    'Khóa: ',
    { ph: 'KHOA_HOC' },
  ]),
  bodyParagraph(['Loại hình đào tạo: ', { ph: 'LOAI_HINH_DAO_TAO' }]),
  bodyParagraph([
    'Trình độ đào tạo: ',
    { ph: 'TRINH_DO' },
    { tabs: 2 },
    'Năm học: ',
    { ph: 'NAM_HOC' },
  ]),
  bodyParagraph(['Tháng, năm nhập học: ', { ph: 'THOI_GIAN_NHAP_HOC' }]),
  bodyParagraph([
    'Hiện tại ',
    { ph: 'HO_TEN' },
    ' là sinh viên lớp ',
    { ph: 'LOP' },
    ' đang học bổ sung các học phần tích lũy để đủ điều kiện xét tốt nghiệp.',
  ]),
];

const buf = fs.readFileSync(srcPath);
const zip = await JSZip.loadAsync(buf);
let xml = await zip.file('word/document.xml').async('string');

const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/);
if (!bodyMatch) throw new Error('Không tìm thấy w:body');
const bodyInner = bodyMatch[1];

const childRe = /<w:tbl\b[\s\S]*?<\/w:tbl>|<w:p\b[\s\S]*?<\/w:p>|<w:sectPr\b[\s\S]*?<\/w:sectPr>/g;
const originalChildren = [];
let cm;
while ((cm = childRe.exec(bodyInner)) !== null) {
  originalChildren.push(cm[0]);
}

const children = [];
let mode = 'before';
for (const child of originalChildren) {
  if (child.startsWith('<w:sectPr')) {
    children.push(child);
    continue;
  }
  if (child.startsWith('<w:tbl')) {
    if (mode === 'before' || mode === 'after-date') children.push(child);
    continue;
  }

  const text = [...child.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('');

  if (mode === 'before') {
    if (/^Sinh viên:/i.test(text.trim())) {
      children.push(...bodyParagraphs);
      mode = 'skip-body';
      continue;
    }
    children.push(child);
    continue;
  }
  if (mode === 'skip-body') {
    if (/Cần\s*Thơ/i.test(text) && /NGAY_LAM_DON|ngày/i.test(text)) {
      children.push(child);
      mode = 'after-date';
    }
    continue;
  }
  children.push(child);
}

if (mode !== 'after-date') {
  throw new Error('Rebuild thất bại: không khớp dòng Cần Thơ');
}

const newBodyInner = children.join('');
xml = xml.replace(/<w:body\b[^>]*>[\s\S]*<\/w:body>/, `<w:body>${newBodyInner}</w:body>`);

zip.file('word/document.xml', xml);
const out = await zip.generateAsync({ type: 'nodebuffer' });
fs.writeFileSync(outPath, out);
console.log('Wrote', outPath);

const result = await mammoth.extractRawText({ path: outPath });
const fields = [
  ...new Set((result.value.match(/\{([^}]+)\}/g) || []).map((m) => m.replace(/[{}]/g, ''))),
];
console.log('PLACEHOLDERS:', fields.join(', '));
console.log('---TEXT---');
console.log(result.value);
