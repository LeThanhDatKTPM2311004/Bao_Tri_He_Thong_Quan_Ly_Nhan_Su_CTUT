/**
 * Fix NVQS Word: dòng Cần Thơ ngày/tháng/năm — căn phải + cùng cỡ chữ body (14pt).
 */
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docxPath = path.resolve(
  __dirname,
  '../../client/public/mau-word/Giay_xac_nhan_tam_hoan_NVQS.docx',
);

const buf = fs.readFileSync(docxPath);
const zip = await JSZip.loadAsync(buf);
let xml = await zip.file('word/document.xml').async('string');

xml = xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
  const text = [...paragraph.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('');
  if (!/Cần\s*Thơ/i.test(text) || !/NGAY_LAM_DON|ngày/i.test(text)) return paragraph;

  let next = paragraph;
  // Font 14pt (28 half-points) — khớp thân giấy
  next = next
    .replace(/w:sz w:val="\d+"/g, 'w:sz w:val="28"')
    .replace(/w:szCs w:val="\d+"/g, 'w:szCs w:val="28"');

  // Căn phải, bỏ tab/hanging indent gây lệch
  next = next.replace(/<w:tabs\b[\s\S]*?<\/w:tabs>/g, '');
  next = next.replace(/<w:ind\b[^/]*\/>/g, '');
  if (/<w:jc\b/.test(next)) {
    next = next.replace(/<w:jc\b[^/]*\/>/, '<w:jc w:val="right"/>');
  } else if (next.includes('<w:pPr>')) {
    next = next.replace('<w:pPr>', '<w:pPr><w:jc w:val="right"/>');
  } else {
    next = next.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="right"/></w:pPr>');
  }
  return next;
});

zip.file('word/document.xml', xml);
const out = await zip.generateAsync({ type: 'nodebuffer' });
fs.writeFileSync(docxPath, out);
console.log('Fixed Can Tho date line in', docxPath);
