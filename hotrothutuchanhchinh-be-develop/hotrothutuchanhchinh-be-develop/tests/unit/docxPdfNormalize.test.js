import PizZip from 'pizzip';
import { normalizeDocxForPdfExport } from '../../src/modules/convertFileAndSubmit/docxPdfNormalize.js';

const para = (inner) => `<w:p>${inner}</w:p>`;
const run = (text, sz = 28, bold = false) =>
  `<w:r><w:rPr>${bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;

const makeDocx = (bodyXml) => {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-officedocument.package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${bodyXml}</w:body>
</w:document>`,
  );
  return zip.generate({ type: 'nodebuffer' });
};

const readDocumentXml = (buffer) => new PizZip(buffer).file('word/document.xml').asText();

const paraOf = (xml, re) =>
  [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]).find((p) => re.test(p));

const maxSz = (p) => Math.max(...[...p.matchAll(/w:sz w:val="(\d+)"/g)].map((m) => Number(m[1])));

describe('docxPdfNormalize — bố cục mẫu hành chính', () => {
  test('hierarchy size giống ảnh mẫu', () => {
    const input = makeDocx(
      para(run('UBND THÀNH PHỐ CẦN THƠ', 26)) +
        para(run('TRƯỜNG ĐẠI HỌC', 26, true)) +
        para(run('KỸ THUẬT - CÔNG NGHỆ CẦN THƠ', 26, true)) +
        para(run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 26, true)) +
        para(run('Độc lập - Tự do - Hạnh phúc', 26, true)) +
        para(run('GIẤY XÁC NHẬN', 36, true)) +
        para(run('Trường Đại học Kỹ thuật - Công nghệ Cần Thơ xác nhận:', 28, true)) +
        para(run('Sinh viên: A', 28)),
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    expect(maxSz(paraOf(xml, /^[\s\S]*UBND/))).toBe(26);
    expect(maxSz(paraOf(xml, /CỘNG\s*HÒA/))).toBe(26);
    expect(maxSz(paraOf(xml, /GIẤY\s*XÁC\s*NHẬN/))).toBe(36);
    expect(maxSz(paraOf(xml, /xác\s*nhận/))).toBe(28);
    expect(maxSz(paraOf(xml, /KỸ\s*THUẬT/))).toBe(26);
    expect(maxSz(paraOf(xml, /Sinh\s*viên/))).toBe(28);
    expect(paraOf(xml, /UBND/)).not.toMatch(/<w:b\/>/);
    expect(paraOf(xml, /TRƯỜNG\s*ĐẠI\s*HỌC/)).toMatch(/<w:b\/>/);
    expect(paraOf(xml, /CỘNG\s*HÒA/)).toMatch(/<w:b\/>/);
  });

  test('gỡ Straight Connector — gạch chân theo chữ Độc lập', () => {
    const bad =
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
      run('Độc lập - Tự do - Hạnh phúc', 26, true) +
      `<w:r><w:rPr><w:noProof/></w:rPr>` +
      `<w:drawing><wp:anchor><wp:docPr id="8" name="Straight Connector 2"/>` +
      `<wp:extent cx="1" cy="0"/></wp:anchor></w:drawing></w:r></w:p>`;
    const xml = readDocumentXml(normalizeDocxForPdfExport(makeDocx(bad)));
    expect(xml).not.toMatch(/Straight Connector/);
    expect(paraOf(xml, /Độc\s*lập/)).toMatch(/<w:u w:val="single"\/>/);
    expect(paraOf(xml, /Độc\s*lập/)).not.toMatch(/<w:pBdr/);
  });

  test('gỡ đậm UBND kể cả thẻ w:b tự đóng', () => {
    const input = makeDocx(
      `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>` +
        `<w:t>UBND THÀNH PHỐ CẦN THƠ</w:t></w:r></w:p>`,
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    expect(paraOf(xml, /UBND/)).not.toMatch(/<w:b(?:Cs)?\b/);
  });

  test('tách UBND / TRƯỜNG ĐẠI HỌC', () => {
    const letterheadPara =
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
      run('UBND THÀNH PHỐ CẦN THƠ', 26) +
      `<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>` +
      `<w:t xml:space="preserve"> TRƯỜNG ĐẠI HỌC</w:t></w:r></w:p>`;
    const xml = readDocumentXml(normalizeDocxForPdfExport(makeDocx(letterheadPara)));
    const paras = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
    expect(paras.some((p) => /UBND/i.test(p) && /TRƯỜNG\s*ĐẠI\s*HỌC/i.test(p))).toBe(false);
  });

  test('đơn xin: khẩu hiệu và tên đơn mỗi thứ một dòng, không thụt hẹp', () => {
    const input = makeDocx(
      `<w:p><w:pPr><w:jc w:val="center"/><w:ind w:left="2205" w:right="2016"/></w:pPr>` +
        `${run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 26, true)}</w:p>` +
        `<w:p><w:pPr><w:pStyle w:val="5"/><w:spacing w:line="552" w:lineRule="auto"/>` +
        `<w:ind w:left="3387" w:right="2926"/></w:pPr>` +
        `${run('Độc lập - Tự do - Hạnh phú', 28)}` +
        `<w:r><w:t>c ĐƠN XIN CẤP THẺ SINH VIÊN</w:t></w:r></w:p>`,
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    const paras = [...xml.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)].map((m) => m[0]);
    const motto = paras.find((p) => /Độc\s*lập/.test(p));
    const title = paras.find((p) => /ĐƠN\s+XIN\s+CẤP\s+THẺ/.test(p));
    expect(motto).toBeTruthy();
    expect(title).toBeTruthy();
    expect(motto).not.toMatch(/ĐƠN\s+XIN/);
    expect(title).not.toMatch(/Hạnh\s*phúc/);
    expect(motto).not.toMatch(/w:left="3387"/);
    expect(title).not.toMatch(/w:left="3387"/);
    expect(title).not.toMatch(/w:pStyle/);
    expect(paras.some((p) => /CỘNG\s*HÒA/.test(p) && /w:left="2205"/.test(p))).toBe(false);
  });

  test('khối ký cantSplit', () => {
    const input = makeDocx(
      `<w:p><w:pPr><w:jc w:val="right"/></w:pPr>${run('Cần Thơ, ngày 10 tháng 09 năm 2026', 28)}</w:p>` +
        `<w:p>${run('KT. HIỆU TRƯỞNG', 26, true)}</w:p>` +
        `<w:p>${run('PHÓ HIỆU TRƯỞNG', 26, true)}</w:p>` +
        `<w:p></w:p><w:p></w:p>` +
        `<w:p>${run('Trương Minh Nhật Quang', 26, true)}</w:p>`,
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    expect(xml).toMatch(/<w:cantSplit\/>/);
    expect(xml.replace(/\u00A0/g, ' ')).toMatch(/ngày 10 tháng 9 năm 2026/);
  });

  test('giấy hoàn cảnh: tên trường và quốc hiệu mỗi cột một ô', () => {
    const input = makeDocx(
      `<w:p><w:pPr><w:tabs><w:tab w:val="center" w:pos="6840"/></w:tabs></w:pPr>` +
        `<w:r><w:tab/></w:r>${run('UBND THÀNH PHỐ CẦN THƠ', 26)}` +
        `<w:r><w:tab/></w:r>${run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 26, true)}</w:p>` +
        `<w:p><w:r><w:tab/></w:r>${run('TRƯỜNG ĐẠI HỌC', 26, true)}` +
        `<w:r><w:tab/></w:r>${run('Độc lập - Tự do - Hạnh phúc', 28, true)}</w:p>` +
        `<w:p>${run('KỸ THUẬT - CÔNG NGHỆ CẦN THƠ', 26, true)}</w:p>` +
        `<w:p>${run('GIẤY XÁC NHẬN', 36, true)}</w:p>`,
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    const head = (xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || []).find(
      (table) => /UBND/.test(table) && /CỘNG HÒA/.test(table),
    );
    expect(head).toBeTruthy();
    const cells = head.match(/<w:tc\b[\s\S]*?<\/w:tc>/g);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatch(/KỸ THUẬT/);
    expect(cells[0]).not.toMatch(/CỘNG HÒA/);
    expect(cells[1]).toMatch(/Hạnh phúc/);
    expect(cells[1]).not.toMatch(/KỸ THUẬT/);
  });

  test('đơn xin: cột thông tin thẳng nhau, ngày ký không tràn ô', () => {
    const field =
      `<w:p><w:r><w:t>Email: svcntt2311037@student.ctuet.edu.vn</w:t></w:r>` +
      `<w:r><w:tab/></w:r><w:r><w:t>Điện thoại: 0357905831</w:t></w:r></w:p>`;
    const sign =
      `<w:tbl><w:tblPr><w:tblW w:w="8652" w:type="dxa"/></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="4629"/><w:gridCol w:w="4023"/></w:tblGrid>` +
      `<w:tr><w:tc><w:tcPr><w:tcW w:w="4629" w:type="dxa"/><w:noWrap/></w:tcPr>` +
      `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('Ý kiến của phụ huynh', 26)}</w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="4023" w:type="dxa"/><w:noWrap/></w:tcPr>` +
      `<w:p><w:pPr><w:jc w:val="right"/><w:ind w:left="539" w:right="40"/></w:pPr>` +
      `${run('Cần Thơ, ngày 2 tháng 10 năm 2026', 26)}</w:p>` +
      `<w:p><w:pPr><w:jc w:val="center"/><w:ind w:left="539"/></w:pPr>` +
      `${run('Người làm đơn', 26)}</w:p></w:tc></w:tr></w:tbl>`;
    const opinions =
      `<w:tbl><w:tblPr><w:tblW w:w="9325" w:type="dxa"/></w:tblPr>` +
      `<w:tblGrid><w:gridCol w:w="3578"/><w:gridCol w:w="3139"/><w:gridCol w:w="2608"/></w:tblGrid>` +
      `<w:tr>` +
      `<w:tc><w:tcPr><w:tcW w:w="3578" w:type="dxa"/></w:tcPr><w:p>${run('Ý kiến của P.CTCT-SV-KN', 26)}</w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="3139" w:type="dxa"/></w:tcPr><w:p>${run('Ý kiến của CVHT', 26)}</w:p></w:tc>` +
      `<w:tc><w:tcPr><w:tcW w:w="2608" w:type="dxa"/></w:tcPr><w:p>${run('Ý kiến của Khoa', 26)}</w:p></w:tc>` +
      `</w:tr></w:tbl>`;
    const xml = readDocumentXml(normalizeDocxForPdfExport(makeDocx(field + sign + opinions)));
    const tables = xml.match(/<w:tbl\b[\s\S]*?<\/w:tbl>/g) || [];
    const fields = tables.find((table) => /Điện thoại/.test(table));
    const parent = tables.find((table) => /Người làm đơn/.test(table));
    const row = tables.find((table) => /P\.CTCT-SV-KN/.test(table));
    expect(fields).toMatch(/w:w="6000"/);
    expect(fields).toMatch(/w:w="4080"/);
    expect(parent).not.toMatch(/<w:noWrap\/>/);
    expect(parent).not.toMatch(/w:left="539"/);
    expect(parent).toMatch(/w:w="5680"/);
    expect(row).toMatch(/w:w="3360"/);
    expect(row).not.toMatch(/w:w="2608"/);
  });

  test('giấy tạm hoãn đúng cỡ chữ và lề Nghị định 30/2020', () => {
    const input = makeDocx(
      `<w:tbl><w:tblPr><w:tblW w:w="10231" w:type="dxa"/></w:tblPr>` +
        `<w:tblGrid><w:gridCol w:w="4680"/><w:gridCol w:w="5551"/></w:tblGrid>` +
        `<w:tr>` +
        `<w:tc><w:tcPr><w:tcW w:w="4680" w:type="dxa"/></w:tcPr>` +
        `${para(run('UBND THÀNH PHỐ CẦN THƠ', 26))}` +
        `${para(run('TRƯỜNG ĐẠI HỌC', 26, true))}` +
        `${para(run('KỸ THUẬT - CÔNG NGHỆ CẦN THƠ', 26, true))}` +
        `</w:tc>` +
        `<w:tc><w:tcPr><w:tcW w:w="5551" w:type="dxa"/></w:tcPr>` +
        `${para(run('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 26, true))}` +
        `${para(run('Độc lập - Tự do - Hạnh phúc', 28, true))}` +
        `</w:tc></w:tr></w:tbl>` +
        para(run('GIẤY XÁC NHẬN', 36, true)) +
        para(run('Sinh viên: A', 32)) +
        para(run('KT. HIỆU TRƯỞNG', 32, true)) +
        `<w:sectPr><w:pgSz w:w="11907" w:h="16839"/>` +
        `<w:pgMar w:top="1134" w:right="425" w:bottom="1134" w:left="1304" w:header="431" w:footer="289" w:gutter="0"/>` +
        `</w:sectPr>`,
    );
    const xml = readDocumentXml(normalizeDocxForPdfExport(input));
    expect(xml).toMatch(/w:top="1134"/);
    expect(xml).toMatch(/w:bottom="1134"/);
    expect(xml).toMatch(/w:left="1701"/);
    expect(xml).toMatch(/w:right="850"/);
    expect(maxSz(paraOf(xml, /CỘNG\s*HÒA/))).toBe(24);
    expect(maxSz(paraOf(xml, /Độc\s*lập/))).toBe(26);
    expect(xml).toMatch(/_{39}/);
    expect(xml).toMatch(/_{51}/);
    expect(paraOf(xml, /Độc\s*lập/)).not.toMatch(/<w:u\b/);
    expect(maxSz(paraOf(xml, /GIẤY\s*XÁC\s*NHẬN/))).toBe(28);
    expect(maxSz(paraOf(xml, /Sinh\s*viên/))).toBe(28);
    expect(maxSz(paraOf(xml, /HIỆU\s*TRƯỞNG/))).toBe(26);
    expect(paraOf(xml, /UBND/)).toMatch(/<w:b\/>/);
    expect(xml).toMatch(/w:w="4235"/);
    expect(xml).toMatch(/w:w="5120"/);
    expect(xml).toMatch(/Times New Roman/);
  });
});
