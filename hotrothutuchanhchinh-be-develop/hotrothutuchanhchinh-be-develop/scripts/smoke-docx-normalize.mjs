import PizZip from 'pizzip';
import { normalizeDocxForPdfExport } from '../src/modules/convertFileAndSubmit/docxPdfNormalize.js';

const zip = new PizZip();
zip.file(
  'word/document.xml',
  [
    '<w:p>',
    '<w:pPr><w:jc w:val="center"/></w:pPr>',
    '<w:r><w:t>Độc lập - Tự do - Hạnh phúc</w:t><w:br/>',
    '<w:t>ĐƠN XIN CẤP THẺ SINH VIÊN</w:t></w:r>',
    '</w:p>',
  ].join(''),
);

const out = normalizeDocxForPdfExport(Buffer.from(zip.generate({ type: 'nodebuffer' })));
const xml = new PizZip(out).file('word/document.xml').asText();
console.log(xml);

const paragraphs = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
if (paragraphs.length < 2) throw new Error(`expected split paras, got ${paragraphs.length}`);
if (!/Hạnh\s*phúc/i.test(paragraphs[0])) throw new Error('motto missing');
if (/ĐƠN/i.test(paragraphs[0])) throw new Error('DON still in motto paragraph');
if (!/ĐƠN\s*XIN\s*CẤP/i.test(paragraphs[1])) throw new Error('title missing');
console.log('OK');
