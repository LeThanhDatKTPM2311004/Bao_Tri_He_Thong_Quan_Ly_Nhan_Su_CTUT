import fs from 'fs';
import PizZip from 'pizzip';
import mammoth from 'mammoth';

const path =
  'd:/file_hoc/Nam_4/Thuc_tap/PM_TTHC2/client/public/mau-word/Giay_xac_nhan_tam_hoan_NVQS.docx';

const zip = new PizZip(fs.readFileSync(path));
let xml = zip.file('word/document.xml').asText();

const oldSnippet = 'Hiện là sinh viên Khoa </w:t>';
const newSnippet = 'Hiện là sinh viên Khoa: </w:t>';

if (!xml.includes(oldSnippet)) {
  if (xml.includes(newSnippet)) {
    console.log('Already fixed');
  } else {
    console.error('Pattern not found');
    process.exit(1);
  }
} else {
  xml = xml.replace(oldSnippet, newSnippet);
  zip.file('word/document.xml', xml);
  fs.writeFileSync(path, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Updated Word template: added colon after Khoa');
}

const r = await mammoth.extractRawText({ path });
const line = r.value.split(/\n/).find((l) => l.includes('Hiện là sinh viên'));
console.log('VERIFY:', line);
