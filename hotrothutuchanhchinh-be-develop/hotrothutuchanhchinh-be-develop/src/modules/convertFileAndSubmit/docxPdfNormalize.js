import fs from 'fs';
import PizZip from 'pizzip';

/** Font có đủ tiếng Việt, cài trên Docker (fonts-liberation) và LibreOffice. */
const PDF_SERIF = 'Liberation Serif';
const PDF_SANS = 'Liberation Sans';
const PDF_MONO = 'Liberation Mono';

const FONT_MAP = [
  [/Times New Roman/gi, PDF_SERIF],
  [/TimesNewRomanPSMT/gi, PDF_SERIF],
  [/TimesNewRomanPS-BoldMT/gi, PDF_SERIF],
  [/TimesNewRomanPS-ItalicMT/gi, PDF_SERIF],
  [/TimesNewRoman/gi, PDF_SERIF],
  [/(?<![\p{L}])Times(?![\p{L}])/giu, PDF_SERIF],
  [/\.VnTime/gi, PDF_SERIF],
  [/VN-Times/gi, PDF_SERIF],
  [/VNI-Times/gi, PDF_SERIF],
  [/Tahoma/gi, PDF_SANS],
  [/Calibri/gi, PDF_SANS],
  [/Cambria/gi, PDF_SERIF],
  [/Georgia/gi, PDF_SERIF],
  [/Arial Unicode MS/gi, 'Noto Sans'],
  [/Arial/gi, PDF_SANS],
  [/Courier New/gi, PDF_MONO],
];

const HEADER_HINT = /CỘNG\s*HÒA|Độc\s*lập|Hạnh\s*phúc|ĐƠN\s*XIN|Kính\s*gửi/i;

/** Lề trái tối đa ~2.45cm. Mẫu NVQS dùng 1304 twip; ép nhỏ hơn sẽ lệch khối ký. */
const MAX_SIDE_MARGIN = 1400;

/** 1 mm = 1440/25.4 twip. A4 Word = 11906 x 16838. */
const mmToTwip = (mm) => Math.round((mm * 1440) / 25.4);
const A4_WIDTH_TWIP = 11906;
const A4_HEIGHT_TWIP = 16838;

/**
 * Phụ lục I Nghị định 30/2020/NĐ-CP — lấy biên rộng nhất còn đúng khoảng
 * (trên/dưới 20 mm, trái 30 mm, phải 15 mm) để quốc hiệu 12pt không vỡ dòng.
 */
const NVQS_MARGIN = {
  top: mmToTwip(20),
  bottom: mmToTwip(20),
  left: mmToTwip(30),
  right: mmToTwip(15),
  header: mmToTwip(10),
  footer: mmToTwip(10),
};
const NVQS_CONTENT_WIDTH = A4_WIDTH_TWIP - NVQS_MARGIN.left - NVQS_MARGIN.right;
/** Cột trái đủ "KỸ THUẬT - CÔNG NGHỆ CẦN THƠ" 12pt; cột phải đủ quốc hiệu 12pt. */
const NVQS_LETTERHEAD_LEFT = 4235;

const TIMES_FONT_CANDIDATES = [
  'C:\\Windows\\Fonts\\times.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf',
  '/usr/share/fonts/truetype/msttcorefonts/times.ttf',
];

const timesFontInstalled = () => {
  if (TIMES_FONT_CANDIDATES.some((file) => fs.existsSync(file))) return true;
  const dir = '/usr/share/fonts/truetype/msttcorefonts';
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((name) => /^times/i.test(name) && name.endsWith('.ttf'));
};

const clampAttr = (tag, attr, max) =>
  tag.replace(new RegExp(`${attr}="(\\d+)"`), (_, n) => {
    const value = Number(n);
    return `${attr}="${Number.isFinite(value) ? Math.min(value, max) : n}"`;
  });

const applyFontMap = (xml) => {
  let next = xml;
  for (const [pattern, replacement] of FONT_MAP) {
    next = next.replace(pattern, replacement);
  }
  return next;
};

/**
 * Cap large run sizes inside letterhead-ish paragraphs so long centered lines fit A4.
 * w:sz is half-points (26 = 13pt). Supports both w:sz="36" and w:sz w:val="36".
 */
const softenHeaderFontSizes = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    // Only shrink quốc hiệu lines — keep title "ĐƠN XIN ..." full size so it stays on one line.
    if (!/CỘNG\s*HÒA|Độc\s*lập|Hạnh\s*phúc/i.test(paragraph)) return paragraph;
    if (/^\s*<w:p[^>]*>[\s\S]*?ĐƠN\s*XIN/i.test(paragraph) && !/Hạnh\s*phúc/i.test(paragraph)) {
      return paragraph;
    }
    return paragraph
      .replace(/<w:sz(Cs)?\b([^>]*)>/g, (match, cs, attrs) => {
        const valMatch = attrs.match(/w:val="(\d+)"/);
        if (valMatch) {
          const n = Number(valMatch[1]);
          // Giữ tối đa 14pt — trước ép 13pt làm quốc hiệu/trông nhỏ trên PDF Linux.
          if (Number.isFinite(n) && n > 28) {
            return `<w:sz${cs || ''}${attrs.replace(/w:val="\d+"/, 'w:val="28"')}>`;
          }
          return match;
        }
        return match;
      })
      .replace(/w:sz(Cs)?="(\d+)"/g, (match, cs, size) => {
        const n = Number(size);
        if (!Number.isFinite(n) || n <= 28) return match;
        return `w:sz${cs || ''}="28"`;
      });
  });

/**
 * Cùng file, LibreOffice Linux co cả trang còn ~4/7 so với Windows
 * (đo chữ trên khung xem: local 7px, deploy 4px, cùng bề ngang trang).
 * Chỉ bù trên Linux để mắt nhìn khớp bản local. Windows giữ số gốc.
 */
const LINUX_PDF = process.platform === 'linux';
const fitLinuxShrink = (halfPoints) =>
  LINUX_PDF ? String(Math.round(Number(halfPoints) * (7 / 4))) : String(halfPoints);

/**
 * Half-points. Chỉ giấy tạm hoãn NVQS được phóng 7/4 trên Linux.
 * Đơn xin / giấy khác giữ 13–14pt — phóng chung làm quốc hiệu và tên đơn vỡ dòng.
 */
let headerLetterSz = '26';
let headerDocLapSz = '28';
let headerTitleSz = '36';
let activeNvqs = false;

const setRunSizesInParagraph = (paragraph, size) =>
  paragraph.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    if (!/<w:t\b/i.test(run)) return run;
    if (!/<w:rPr\b/.test(run)) {
      return run.replace(
        /<w:r\b([^>]*)>/,
        `<w:r$1><w:rPr><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr>`,
      );
    }
    return run.replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, (rPr) => {
      let next = rPr
        .replace(/<w:sz(Cs)?\b([^>]*)>/g, (match, cs, attrs) => {
          if (!/w:val=/.test(attrs)) return match;
          return `<w:sz${cs || ''}${attrs.replace(/w:val="\d+"/, `w:val="${size}"`)}>`;
        })
        .replace(/w:sz(Cs)?="(\d+)"/g, (_m, cs) => `w:sz${cs || ''}="${size}"`);
      if (!/<w:sz\b/.test(next) && !/w:sz=/.test(next)) {
        next = next.replace(
          /<w:rPr\b([^>]*)>/,
          `<w:rPr$1><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
        );
      }
      return next;
    });
  });

const BOLD_TAG_RE = /<w:b(?:Cs)?\b[^>]*\/>|<w:b(?:Cs)?\b[^>]*>\s*<\/w:b(?:Cs)?>/g;

const ensureBoldInRuns = (paragraph, bold) =>
  paragraph.replace(/<w:rPr\b[\s\S]*?<\/w:rPr>/g, (rPr) => {
    const hasB = /<w:b(?:Cs)?\b/.test(rPr);
    if (bold && !hasB) {
      return rPr.replace(/<w:rPr\b([^>]*)>/, '<w:rPr$1><w:b/><w:bCs/>');
    }
    if (!bold && hasB) {
      return rPr.replace(BOLD_TAG_RE, '');
    }
    return rPr;
  });

/**
 * Áp bố cục/size đúng mẫu hành chính (ảnh tham chiếu):
 * - Letterhead/quốc hiệu 13pt; UBND không đậm; các dòng còn lại đậm
 * - GIẤY XÁC NHẬN 18pt đậm
 * - Dòng "… xác nhận:" 14pt đậm
 */
const applyOfficialHeaderLayout = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (!text) return paragraph;
    if (/Sinh\s*viên:|HIỆU\s*TRƯỞNG|Cần\s*Thơ,\s*ngày/i.test(text)) return paragraph;

    let size = null;
    let bold = null;

    if (/^GIẤY\s*XÁC\s*NHẬN$/i.test(text)) {
      size = headerTitleSz;
      bold = true;
    } else if (/xác\s*nhận\s*:/i.test(text) && /Trường|Đại\s*học/i.test(text)) {
      size = activeBodySz;
      bold = true;
    } else if (/^UBND\b/i.test(text) && !/CỘNG\s*HÒA/i.test(text)) {
      size = headerLetterSz;
      // NĐ 30: tên cơ quan in hoa, đứng, đậm. Mẫu khác giữ UBND không đậm theo file gốc.
      bold = activeNvqs;
    } else if (/^TRƯỜNG\s*ĐẠI\s*HỌC$/i.test(text)) {
      size = headerLetterSz;
      bold = true;
    } else if (/^KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i.test(text)) {
      size = headerLetterSz;
      bold = true;
    } else if (/^Độc\s*lập\b/i.test(text)) {
      // Mẫu Word: chữ khẩu hiệu 14pt, khác dòng quốc hiệu 13pt.
      size = headerDocLapSz;
      bold = true;
    } else if (/^CỘNG\s*HÒA\b/i.test(text)) {
      size = headerLetterSz;
      bold = true;
    } else {
      return paragraph;
    }

    let next = setRunSizesInParagraph(paragraph, size);
    next = ensureBoldInRuns(next, bold);
    return next;
  });

/** Đơn thường (ví dụ cấp thẻ) giữ 14pt — người dùng đã thấy cỡ này là đúng. */
const BODY_SZ = 28;
/**
 * Giấy xác nhận tạm hoãn: cùng 14pt nhưng khung xem hiện chữ nhỏ hơn đơn cấp thẻ
 * (tiêu đề 2 cột + LibreOffice co trang). 16pt để mắt nhìn ngang với đơn cấp thẻ.
 */
const OFFICIAL_BODY_SZ = Number(fitLinuxShrink(32));

let activeBodySz = String(BODY_SZ);
let activeSignSz = '26';

const isFixedSizeParagraph = (text) => {
  if (!text) return true;
  if (/^Số\s*:/i.test(text)) return true;
  if (/^ĐƠN\s+XIN\b/i.test(text)) return true;
  if (/^(UBND|TRƯỜNG\s*ĐẠI\s*HỌC|KỸ\s*THUẬT|CỘNG\s*HÒA|Độc\s*lập|GIẤY\s*XÁC\s*NHẬN)\b/i.test(text)) {
    return true;
  }
  if (/xác\s*nhận\s*:/i.test(text) && /Trường|Đại\s*học/i.test(text)) return true;
  if (/Cần\s*Thơ,\s*ngày/i.test(text)) return true;
  if (/HIỆU\s*TRƯỞNG|TEN_NGUOI_KY/i.test(text)) return true;
  return false;
};

const applyStandardBodySize = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (isFixedSizeParagraph(text)) return paragraph;
    return setRunSizesInParagraph(paragraph, activeBodySz);
  });

/**
 * Tab căn giữa 6840 twip nằm trong ô letterhead hẹp hơn thế.
 * LibreOffice Linux co cả trang để nhét tab đó — chữ thân đơn nhỏ đi rõ.
 */
const stripLetterheadTabs = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    const pairedLetterhead =
      (/UBND/i.test(text) && /CỘNG\s*HÒA/i.test(text)) ||
      (/TRƯỜNG\s*ĐẠI\s*HỌC/i.test(text) && /Độc\s*lập/i.test(text));
    if (pairedLetterhead) return paragraph;
    if (
      !/^(UBND|TRƯỜNG\s*ĐẠI\s*HỌC|KỸ\s*THUẬT|CỘNG\s*HÒA|Độc\s*lập|GIẤY\s*XÁC\s*NHẬN)\b/i.test(
        text,
      )
    ) {
      return paragraph;
    }
    return paragraph.replace(/<w:tabs\b[\s\S]*?<\/w:tabs>/g, '').replace(/<w:tab\/>/g, '');
  });

const filterWideTabs = (tabs) => {
  const kept = [...tabs.matchAll(/<w:tab\b[^>]*\/>/g)].filter((match) => {
    const pos = match[0].match(/w:pos="(\d+)"/);
    return !pos || Number(pos[1]) < 4000;
  });
  if (!kept.length) return '';
  return `<w:tabs>${kept.map((match) => match[0]).join('')}</w:tabs>`;
};

/**
 * Tab căn giữa ≥ 4000 twip trong ô hẹp hoặc đoạn trống làm LibreOffice Linux
 * nới khổ trang rồi co chữ. Giữ tab đó trên đoạn quốc hiệu dạng một dòng hai cột
 * (giấy hoàn cảnh) — gỡ tab này làm "UBND…CỘNG HÒA" dính liền.
 */
const stripWideTabStops = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    const pairedLetterhead =
      (/UBND/i.test(text) && /CỘNG\s*HÒA/i.test(text)) ||
      (/TRƯỜNG\s*ĐẠI\s*HỌC/i.test(text) && /Độc\s*lập/i.test(text));
    if (pairedLetterhead) return paragraph;
    return paragraph.replace(/<w:tabs\b[\s\S]*?<\/w:tabs>/g, filterWideTabs);
  });

/**
 * Cột phải ("Thời gian đào tạo", "Năm học", "Dự kiến…") đang dựa vào hai tab mặc định.
 * Nhãn trái ngắn hơn ("Trình độ đào tạo: Kỹ sư") thì "Năm học" dừng sớm một nấc (720 twip).
 * Một tab trái tại 5040 twip — đúng chỗ "Thời gian" và "Dự kiến" đang đứng.
 * Chạy sau stripWideTabStops vì mốc này > 4000.
 */
const PAIRED_FIELD_TAB = '5040';
const alignPairedFieldColumns = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!/<w:tab\/>/.test(paragraph)) return paragraph;
    const text = paragraphPlainText(paragraph);
    if (
      !/(?:Khóa|Thời gian đào tạo|Năm học|Dự kiến thời gian tốt nghiệp)\s*:/.test(text)
    ) {
      return paragraph;
    }
    let next = paragraph.replace(/(<w:tab\/>\s*){2,}/g, '<w:tab/>');
    const tabDef = `<w:tabs><w:tab w:val="left" w:pos="${PAIRED_FIELD_TAB}"/></w:tabs>`;
    if (/<w:tabs\b/.test(next)) {
      next = next.replace(/<w:tabs\b[\s\S]*?<\/w:tabs>/, tabDef);
    } else if (/<w:pPr\b/.test(next)) {
      next = next.replace(/<w:pPr\b([^>]*)>/, `<w:pPr$1>${tabDef}`);
    } else {
      next = next.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr>${tabDef}</w:pPr>`);
    }
    return next;
  });

/** Zoom xem 130% không đổi PDF trên Windows, nhưng Linux co cả trang cho vừa. */
const forcePrintZoom = (xml) =>
  xml.includes('<w:zoom')
    ? xml.replace(/<w:zoom\b[^>]*\/>/g, '<w:zoom w:percent="100"/>')
    : xml;

/**
 * Gỡ Straight Connector (vẽ tuyệt đối) — khi tăng font, line đè giữa chữ "Độc lập…".
 * Thay bằng gạch chân run (w:u) — đúng mẫu: gạch theo bề ngang chữ, không kéo cả cột.
 */
const fixLetterheadUnderlines = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    const needsUnderline =
      /^Độc\s*lập\b/i.test(text) || /^KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i.test(text);
    const hasConnector =
      /Straight\s*Connector|<w:drawing\b|<w:pict\b|<mc:AlternateContent\b/i.test(paragraph);
    if (!needsUnderline && !hasConnector) return paragraph;

    let next = paragraph
      .replace(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/gi, '')
      .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi, '')
      .replace(/<w:pict\b[\s\S]*?<\/w:pict>/gi, '')
      .replace(/<w:pBdr\b[\s\S]*?<\/w:pBdr>/gi, '');

    next = next.replace(/<w:r\b[^>]*>\s*<w:rPr\b[\s\S]*?<\/w:rPr>\s*<\/w:r>/gi, (run) =>
      /<w:t\b|<w:drawing\b|<w:pict\b|<w:br\b|<w:tab\b/i.test(run) ? run : '',
    );

    if (!needsUnderline || activeNvqs) return next;

    return next.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
      if (!/<w:t\b/i.test(run)) return run;
      if (/<w:u\b/i.test(run)) return run;
      if (/<w:rPr\b[\s\S]*?<\/w:rPr>/.test(run)) {
        return run.replace(/<w:rPr\b([^>]*)>/, '<w:rPr$1><w:u w:val="single"/>');
      }
      return run.replace(/<w:r\b([^>]*)>/, '<w:r$1><w:rPr><w:u w:val="single"/></w:rPr>');
    });
  });

/**
 * Quốc hiệu: một run Times/Liberation, khoảng NBSP giữa từ, không kerning âm
 * (kerning -40 làm PDF LO dính chữ: CỘNGHÒAXÃHỘI…).
 */
const fixNationalMottoLine = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (!/^CỘNG\s*HÒA\s*XÃ\s*HỘI\s*CHỦ\s*NGHĨA\s*VIỆT\s*NAM$/i.test(text)) {
      return paragraph;
    }

    const motto = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    const openMatch = paragraph.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    let pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    if (!/<w:jc\b/i.test(pPr)) {
      pPr = pPr.includes('</w:pPr>')
        ? pPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>')
        : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }

    return (
      `${open}${pPr}` +
      `${timesRun(motto, { bold: true, size: headerLetterSz })}` +
      `</w:p>`
    );
  });

/**
 * Dòng tên trường (cột trái): giữ "CẦN THƠ" liền, 12pt + underline.
 */
const fixAgencyTechLine = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (!/^KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ\s*CẦN\s*THƠ$/i.test(text)) {
      return paragraph;
    }

    const line = 'KỸ THUẬT - CÔNG NGHỆ CẦN\u00A0THƠ';
    const openMatch = paragraph.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    let pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    if (!/<w:jc\b/i.test(pPr)) {
      pPr = pPr.includes('</w:pPr>')
        ? pPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>')
        : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }

    return (
      `${open}${pPr}` +
      `${timesRun(line, {
        bold: true,
        size: headerLetterSz,
        underline: !activeNvqs,
        // NVQS Linux siết nhẹ để "CẦN THƠ" không rớt. Đơn khác siết -12 như file Word gốc.
        // -40/-64 làm chữ dính.
        spacing: activeNvqs && LINUX_PDF ? '-24' : activeNvqs ? null : '-12',
      })}` +
      `</w:p>`
    );
  });

const LETTERHEAD_LINE_HINT =
  /UBND|CỘNG\s*HÒA|Độc\s*lập|Hạnh\s*phúc|TRƯỜNG\s*ĐẠI\s*HỌC|KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i;

/** Bỏ kerning âm trong run — chữ bị ép sát nhìn nhỏ/không tự nhiên trên PDF. */
const stripCondensedCharSpacing = (xml) =>
  xml.replace(/<w:spacing\b([^>]*?)w:val="(-\d+)"([^>]*?)\/>/g, (match) => {
    // Chỉ đụng spacing trong rPr (kerning), không đụng paragraph spacing before/after.
    if (/w:before=|w:after=|w:line=/i.test(match)) return match;
    return '';
  }).replace(/<w:fitText\b[^>]*\/>/g, '');

const tableLimit = () => (activeNvqs ? NVQS_CONTENT_WIDTH : MAX_TABLE_WIDTH);

const clampPageMargins = (xml) => {
  if (!activeNvqs) {
    return xml.replace(/<w:pgMar\b[^>]*\/>/g, (tag) => {
      let next = clampAttr(tag, 'w:left', MAX_SIDE_MARGIN);
      next = clampAttr(next, 'w:right', MAX_SIDE_MARGIN);
      return next;
    });
  }

  const mar =
    `<w:pgMar w:top="${NVQS_MARGIN.top}" w:right="${NVQS_MARGIN.right}" ` +
    `w:bottom="${NVQS_MARGIN.bottom}" w:left="${NVQS_MARGIN.left}" ` +
    `w:header="${NVQS_MARGIN.header}" w:footer="${NVQS_MARGIN.footer}" w:gutter="0"/>`;
  const sz = `<w:pgSz w:w="${A4_WIDTH_TWIP}" w:h="${A4_HEIGHT_TWIP}"/>`;
  let next = xml;
  if (!/<w:sectPr\b/.test(next)) {
    return next.replace(/<\/w:body>/, `<w:sectPr>${sz}${mar}</w:sectPr></w:body>`);
  }
  next = /<w:pgSz\b/.test(next)
    ? next.replace(/<w:pgSz\b[^>]*\/>/g, sz)
    : next.replace(/<w:sectPr\b([^>]*)>/, `<w:sectPr$1>${sz}`);
  next = /<w:pgMar\b/.test(next)
    ? next.replace(/<w:pgMar\b[^>]*\/>/g, mar)
    : next.replace(/<w:sectPr\b([^>]*)>/, `<w:sectPr$1>${mar}`);
  return next;
};

/**
 * Widen narrow table cells that hold the national motto / title so LibreOffice
 * does not wrap mid-phrase ("Hạnh" / "phúc").
 * Không nới quá khổ trang — LO Linux sẽ scale cả bảng (chữ nhỏ đi rõ rệt).
 */
const widenLetterheadCells = (xml) =>
  xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
    if (!HEADER_HINT.test(cell)) return cell;
    return cell.replace(/<w:tcW\b[^>]*\/>/g, (tcW) => {
      const widthMatch = tcW.match(/w:w="(\d+)"/);
      if (!widthMatch) return tcW;
      const width = Number(widthMatch[1]);
      // Chỉ nới nhẹ ô quá hẹp; giữ ≤ ~9.5cm để 2 cột vẫn nằm trong A4.
      if (!Number.isFinite(width) || width >= 5200) return tcW;
      return tcW.replace(/w:w="\d+"/, 'w:w="5200"');
    });
  });

/** Vùng in A4 sau lề mẫu (trái 1304, phải 425). */
const MAX_TABLE_WIDTH = 10080;

const syncTblGridToWidths = (table, colWidths) => {
  if (!colWidths.length || !/<w:tblGrid\b/.test(table)) return table;
  const grid = `<w:tblGrid>${colWidths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>`;
  return table.replace(/<w:tblGrid\b[\s\S]*?<\/w:tblGrid>/, grid);
};

/** Co bảng vượt khổ trang + đồng bộ gridCol với tcW (tránh LO scale chữ).
 * Chỉ lấy bề rộng cột từ hàng đầu — cộng mọi ô mọi hàng sẽ làm hỏng tblGrid. */
const clampOversizedTables = (xml) =>
  xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => {
    const firstRowMatch = table.match(/<w:tr\b[\s\S]*?<\/w:tr>/);
    const firstRow = firstRowMatch ? firstRowMatch[0] : table;
    const widthMatches = [...firstRow.matchAll(/<w:tcW\b[^>]*w:w="(\d+)"[^>]*\/>/g)];
    if (!widthMatches.length) return table;

    const widths = widthMatches.map((m) => Number(m[1]));
    const sum = widths.reduce((a, b) => a + b, 0);
    let nextWidths = widths;

    const limit = tableLimit();
    if (sum > limit) {
      const scale = limit / sum;
      nextWidths = widths.map((w) => Math.max(400, Math.round(w * scale)));
      const scaledSum = nextWidths.reduce((a, b) => a + b, 0);
      nextWidths[nextWidths.length - 1] += limit - scaledSum;
    }

    const colCount = nextWidths.length;
    let colIndex = 0;
    let next = table.replace(/<w:tcW\b[^>]*\/>/g, (tcW) => {
      const w = nextWidths[colIndex % colCount];
      colIndex += 1;
      return Number.isFinite(w) ? tcW.replace(/w:w="\d+"/, `w:w="${w}"`) : tcW;
    });

    const total = nextWidths.reduce((a, b) => a + b, 0);
    if (/<w:tblW\b/.test(next)) {
      next = next.replace(/<w:tblW\b[^>]*\/>/, `<w:tblW w:w="${total}" w:type="dxa"/>`);
    }

    return syncTblGridToWidths(next, nextWidths);
  });

/**
 * LibreOffice co chữ cả bảng khi bảng rộng hơn vùng in hoặc đang autofit.
 * Khóa layout cố định và bỏ thụt âm để cỡ chữ trong file là cỡ chữ trên PDF.
 */
const lockTablesAgainstShrink = (xml) =>
  xml.replace(/<w:tblPr\b[\s\S]*?<\/w:tblPr>/g, (tblPr) => {
    let next = tblPr.replace(
      /<w:tblInd\b[^>]*w:w="-\d+"[^>]*\/>/g,
      '<w:tblInd w:w="0" w:type="dxa"/>',
    );
    if (/<w:tblLayout\b/.test(next)) {
      next = next.replace(/<w:tblLayout\b[^>]*\/>/g, '<w:tblLayout w:type="fixed"/>');
    } else {
      next = next.replace(/<\/w:tblPr>/, '<w:tblLayout w:type="fixed"/></w:tblPr>');
    }
    return next;
  });

/** Style mặc định 12pt làm dòng thiếu w:sz nhỏ hơn mẫu 14pt. */
const raiseDocDefaults = (xml) => {
  if (!xml.includes('<w:docDefaults')) return xml;
  return xml.replace(/<w:docDefaults\b[\s\S]*?<\/w:docDefaults>/g, (block) =>
    block.replace(/<w:sz(?:Cs)?\b[^>]*>/g, (tag) =>
      tag.replace(/w:val="(\d+)"/, (match, n) => {
        const size = Number(n);
        if (!Number.isFinite(size) || size >= BODY_SZ || size < 16) return match;
        return `w:val="${BODY_SZ}"`;
      }),
    ),
  );
};

/**
 * Ưu tiên cân 2 cột letterhead — đủ chỗ cho cả "KỸ THUẬT…" và "CỘNG HÒA…".
 */
const balanceLetterheadColumns = (xml) =>
  xml.replace(/<w:tbl\b[\s\S]*?<\/w:tbl>/g, (table) => {
    if (!/UBND/i.test(table) || !/CỘNG\s*HÒA/i.test(table)) return table;
    const firstRowMatch = table.match(/<w:tr\b[\s\S]*?<\/w:tr>/);
    if (!firstRowMatch) return table;
    const widthMatches = [...firstRowMatch[0].matchAll(/<w:tcW\b[^>]*w:w="(\d+)"[^>]*\/>/g)];
    if (widthMatches.length !== 2) return table;

    // Trái đủ tên trường; phải đủ quốc hiệu. Giấy tạm hoãn dùng cỡ 12pt trong lề NĐ 30.
    const total = tableLimit();
    const left = activeNvqs ? NVQS_LETTERHEAD_LEFT : 4520;
    const right = total - left;
    const nextWidths = [left, right];
    let colIndex = 0;
    let next = table.replace(/<w:tcW\b[^>]*\/>/g, (tcW) => {
      const w = nextWidths[colIndex % nextWidths.length];
      colIndex += 1;
      return tcW.replace(/w:w="\d+"/, `w:w="${w}"`);
    });
    if (/<w:tblW\b/.test(next)) {
      next = next.replace(/<w:tblW\b[^>]*\/>/, `<w:tblW w:w="${total}" w:type="dxa"/>`);
    }
    const zeroMar =
      '<w:tblCellMar>' +
      '<w:top w:w="0" w:type="dxa"/>' +
      '<w:left w:w="0" w:type="dxa"/>' +
      '<w:bottom w:w="0" w:type="dxa"/>' +
      '<w:right w:w="0" w:type="dxa"/>' +
      '</w:tblCellMar>';
    if (/<w:tblCellMar\b/.test(next)) {
      next = next.replace(/<w:tblCellMar\b[\s\S]*?<\/w:tblCellMar>/, zeroMar);
    } else {
      next = next.replace(/<\/w:tblPr>/, `${zeroMar}</w:tblPr>`);
    }
    return syncTblGridToWidths(next, nextWidths);
  });

const DATE_LINE_HINT = /Cần\s*Thơ|C[aàảãạáắằẳẵặâấầẩẫậ]n\s*Th[ơoóòỏõọ]|ngày|tháng|năm|NGAY_LAM_DON|NAM_LAM_DON/i;

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const paragraphPlainText = (paragraph) =>
  [...paragraph.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isBirthDateParagraph = (text) =>
  /ngày\s*,?\s*tháng\s*,?\s*năm\s*sinh/i.test(text) || /\bsinh\s*:/i.test(text);

/** Dòng địa điểm/ngày ký (Cần Thơ…) — không gồm "Ngày, tháng, năm sinh". */
const isDateLineParagraph = (paragraph) => {
  const text = paragraphPlainText(paragraph);
  if (!text) return false;
  if (isBirthDateParagraph(text)) return false;
  if (/Cần\s*Thơ/i.test(text) && /ngày|năm/i.test(text)) return true;
  // "… ngày 10 tháng 09 năm 2026" (không có nhãn "sinh")
  if (/ngày\s+\d/i.test(text) && /tháng/i.test(text) && /năm/i.test(text)) return true;
  if (/\{NGAY_LAM_DON\}|\{THANG_LAM_DON\}|\{NAM_LAM_DON\}/i.test(text)) return true;
  return false;
};

const pickParagraphFontSize = (paragraph, fallback = '28') => {
  const sizes = [...paragraph.matchAll(/w:sz(?:Cs)?\s+w:val="(\d+)"/g)].map((m) => Number(m[1]));
  const usable = sizes.filter((n) => Number.isFinite(n) && n >= 22);
  if (!usable.length) return fallback;
  return String(Math.max(...usable));
};

const isYearOnlyParagraph = (paragraph) => {
  const text = paragraphPlainText(paragraph);
  return /^\d{4}$/.test(text);
};

/** Bỏ soft-break trong đoạn ngày tháng (nguyên nhân phổ biến làm năm xuống dòng). */
const stripSoftBreaksInDateParagraphs = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!isDateLineParagraph(paragraph) && !DATE_LINE_HINT.test(paragraph)) {
      return paragraph;
    }
    if (!/<w:br\b/i.test(paragraph)) return paragraph;
    return paragraph.replace(/<w:br\b[^/]*\/>|<w:br\b[^>]*>\s*<\/w:br>/gi, '');
  });

/**
 * Gộp đoạn chỉ chứa năm (vd. "2026") vào đoạn trước có "ngày … tháng … năm".
 */
const mergeTrailingYearParagraph = (xml) =>
  xml.replace(/(<w:p\b[\s\S]*?<\/w:p>)(\s*)(<w:p\b[\s\S]*?<\/w:p>)/g, (match, first, gap, second) => {
    if (!isDateLineParagraph(first)) return match;
    if (!isYearOnlyParagraph(second)) return match;

    const year = paragraphPlainText(second);
    const firstText = paragraphPlainText(first);
    // Chỉ gộp khi đoạn trước kết thúc bằng "năm" (chưa có năm số).
    if (!/năm\s*$/i.test(firstText) || /\d{4}\s*$/.test(firstText)) return match;

    const openMatch = first.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = first.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const italic = /<w:i\b/i.test(first);
    const fontSize = pickParagraphFontSize(first, '28');
    const combined = `${firstText}\u00A0\u2060${year}`
      .replace(/ngày\s+/gi, 'ngày\u00A0')
      .replace(/\s+tháng\s+/gi, '\u00A0tháng\u00A0')
      .replace(/\s+năm\s+/gi, '\u00A0năm\u00A0\u2060');

    const rPr =
      `<w:rPr>` +
      serifFonts +
      (italic ? `<w:i/><w:iCs/>` : '') +
      `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>` +
      `</w:rPr>`;

    return (
      `${open}${pPr}` +
      `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(combined)}</w:t></w:r>` +
      `</w:p>`
    );
  });

/**
 * Gộp đoạn bắt đầu bằng "năm" (vd. "năm 2026") vào đoạn ngày tháng ngay trước.
 */
const mergeLeadingYearParagraph = (xml) =>
  xml.replace(/(<w:p\b[\s\S]*?<\/w:p>)(\s*)(<w:p\b[\s\S]*?<\/w:p>)/g, (match, first, gap, second) => {
    if (!isDateLineParagraph(first)) return match;
    const secondText = paragraphPlainText(second);
    if (!/^năm\s*\d{4}$/i.test(secondText)) return match;
    const firstText = paragraphPlainText(first);
    if (/\d{4}\s*$/.test(firstText)) return match;

    const openMatch = first.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = first.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    const pPr = pPrMatch ? pPrMatch[0] : '';
    const italic = /<w:i\b/i.test(first);
    const fontSize = pickParagraphFontSize(first, '28');
    const combined = `${firstText}\u00A0\u2060${secondText.replace(/^năm\s*/i, '')}`
      .replace(/ngày\s+/gi, 'ngày\u00A0')
      .replace(/\s+tháng\s+/gi, '\u00A0tháng\u00A0')
      .replace(/\s+năm\s*/gi, '\u00A0năm\u00A0\u2060');

    const rPr =
      `<w:rPr>` +
      serifFonts +
      (italic ? `<w:i/><w:iCs/>` : '') +
      `<w:sz w:val="${fontSize}"/><w:szCs w:val="${fontSize}"/>` +
      `</w:rPr>`;

    return (
      `${open}${pPr}` +
      `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(combined)}</w:t></w:r>` +
      `</w:p>`
    );
  });

/**
 * Khối ký nửa phải — dùng bảng 2 cột (LibreOffice hay bỏ qua w:ind khi jc=center).
 */
const SIGN_LEFT_PPR =
  `<w:pPr>` +
  `<w:jc w:val="left"/>` +
  `<w:ind w:left="0" w:right="0"/>` +
  `<w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/>` +
  `</w:pPr>`;

const SIGN_INNER_PPR =
  `<w:pPr>` +
  `<w:keepNext/>` +
  `<w:jc w:val="center"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `<w:spacing w:before="0" w:after="40" w:line="276" w:lineRule="auto"/>` +
  `</w:pPr>`;

const SIGN_INNER_SPACER_PPR =
  `<w:pPr>` +
  `<w:keepNext/>` +
  `<w:jc w:val="center"/>` +
  `<w:spacing w:before="0" w:after="0" w:line="460" w:lineRule="auto"/>` +
  `</w:pPr>`;

const SIGN_INNER_NAME_PPR =
  `<w:pPr>` +
  `<w:jc w:val="center"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `<w:spacing w:before="80" w:after="0" w:line="276" w:lineRule="auto"/>` +
  `</w:pPr>`;

const serifFonts =
  `<w:rFonts w:ascii="${PDF_SERIF}" w:hAnsi="${PDF_SERIF}" w:cs="${PDF_SERIF}" w:eastAsia="${PDF_SERIF}"/>`;

const timesRun = (text, { italic = false, bold = false, underline = false, size = '26', spacing = null } = {}) =>
  `<w:r>` +
  `<w:rPr>` +
  serifFonts +
  (bold ? `<w:b/><w:bCs/>` : '') +
  (italic ? `<w:i/><w:iCs/>` : '') +
  (underline ? `<w:u w:val="single"/>` : '') +
  (spacing ? `<w:spacing w:val="${spacing}"/>` : '') +
  `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
  `</w:rPr>` +
  `<w:t xml:space="preserve">${escapeXml(text)}</w:t>` +
  `</w:r>`;

const makeInnerParagraph = (text, style, pPr = SIGN_INNER_PPR) => {
  if (!String(text || '').trim()) {
    return `<w:p>${pPr}</w:p>`;
  }
  return `<w:p>${pPr}${timesRun(text, style)}</w:p>`;
};

/**
 * Bảng 1 cột ~8.5cm, căn phải trang.
 * LibreOffice thường co cột trống của bảng 2 cột rồi căn giữa — jc=right ổn định hơn.
 */
const buildRightSignTable = (innerXml, colW = 7800) => {
  const zeroMar =
    '<w:tblCellMar>' +
    '<w:top w:w="0" w:type="dxa"/>' +
    '<w:left w:w="0" w:type="dxa"/>' +
    '<w:bottom w:w="0" w:type="dxa"/>' +
    '<w:right w:w="0" w:type="dxa"/>' +
    '</w:tblCellMar>';
  return (
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="${colW}" w:type="dxa"/>` +
    `<w:jc w:val="right"/>` +
    `<w:tblInd w:w="0" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>` +
    `<w:insideH w:val="nil"/><w:insideV w:val="nil"/>` +
    `</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    zeroMar +
    `<w:tblLook w:val="0000"/>` +
    `</w:tblPr>` +
    `<w:tblGrid><w:gridCol w:w="${colW}"/></w:tblGrid>` +
    `<w:tr>` +
    `<w:trPr><w:cantSplit/></w:trPr>` +
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${colW}" w:type="dxa"/>` +
    `<w:vAlign w:val="top"/>` +
    `</w:tcPr>` +
    `${innerXml}` +
    `</w:tc>` +
    `</w:tr>` +
    `</w:tbl>`
  );
};

/**
 * Gộp dòng "Cần Thơ, ngày … tháng … năm …" thành một hàng, bỏ số 0 đầu.
 * Dùng NBSP + font 13pt để LibreOffice không đẩy năm xuống dòng trong cột ký.
 * (Vị trí phải do layoutOfficialSignColumn bọc bảng.)
 */
const keepCanThoDateOnOneLine = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!isDateLineParagraph(paragraph)) return paragraph;

    const full = paragraphPlainText(paragraph);
    if (!/Cần\s*Thơ/i.test(full) || !/ngày/i.test(full) || !/năm/i.test(full)) return paragraph;

    const collapsed = full.replace(/\s+/g, ' ').trim();
    const fixed = collapsed
      .replace(/,\s*/g, ',\u00A0')
      .replace(/ngày\s+0*(\d+)/gi, 'ngày\u00A0$1')
      .replace(/tháng\s+0*(\d+)/gi, 'tháng\u00A0$1')
      .replace(/\s+năm\s+/gi, '\u00A0năm\u00A0')
      .replace(/năm\s+0*(\d{4})/gi, 'năm\u00A0$1')
      .replace(/năm\s+/gi, 'năm\u00A0')
      .replace(/ngày\s+/gi, 'ngày\u00A0')
      .replace(/tháng\s+/gi, 'tháng\u00A0');

    // Giấy tạm hoãn dùng cùng cỡ thân đơn; đơn khác giữ 13pt. NBSP giữ năm trên một dòng.
    const fontSize = activeSignSz;
    const italic = activeNvqs ? true : /<w:i(?:Cs)?\b/i.test(paragraph);
    const openMatch = paragraph.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    let pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="right"/></w:pPr>';
    if (!/<w:jc\b/i.test(pPr)) {
      pPr = pPr.includes('</w:pPr>')
        ? pPr.replace(/<\/w:pPr>/, '<w:jc w:val="right"/></w:pPr>')
        : '<w:pPr><w:jc w:val="right"/></w:pPr>';
    }
    if (/<w:keepLines\b/i.test(pPr)) {
      /* already kept */
    } else if (pPr.includes('</w:pPr>')) {
      pPr = pPr.replace(/<\/w:pPr>/, '<w:keepLines/></w:pPr>');
    }
    return (
      `${open}${pPr}` +
      `${timesRun(fixed, { italic, size: fontSize })}` +
      `</w:p>`
    );
  });

/** Nới ô bảng chứa dòng địa điểm / người làm đơn để giảm wrap. */
const widenSignerDateCells = (xml) =>
  xml.replace(/<w:tc\b[\s\S]*?<\/w:tc>/g, (cell) => {
    // Không đụng letterhead (ô "UBND … CẦN THƠ" cũng chứa chữ Cần Thơ).
    if (/UBND|CỘNG\s*HÒA|Độc\s*lập|TRƯỜNG\s*ĐẠI\s*HỌC/i.test(cell)) return cell;
    if (/HIỆU\s*TRƯỞNG|TEN_NGUOI_KY/i.test(cell)) return cell;

    const isSignerDateCell =
      /Người\s*làm\s*đơn|NAM_LAM_DON|NGAY_LAM_DON|THANG_LAM_DON/i.test(cell) ||
      (/Cần\s*Thơ/i.test(cell) && /ngày/i.test(cell)) ||
      /ngày.+\d+.+\tháng.+\d+.+\năm/i.test(cell);
    if (!isSignerDateCell) return cell;

    // noWrap làm dòng ngày tràn sang cột "Ý kiến" / "Người làm đơn".
    const next = cell.replace(/<w:noWrap\/>/g, '');

    return next.replace(/<w:tcW\b[^>]*\/>/g, (tcW) => {
      const widthMatch = tcW.match(/w:w="(\d+)"/);
      if (!widthMatch) return tcW;
      const width = Number(widthMatch[1]);
      // Tối đa ~ nửa trang — không vượt khổ in (tránh LO scale font).
      if (!Number.isFinite(width) || width >= 5000) return tcW;
      return tcW.replace(/w:w="\d+"/, 'w:w="5000"');
    });
  });

const SIGN_TITLE_HINT =
  /KT\.\s*HIỆU\s*TRƯỞNG|PHÓ\s*HIỆU\s*TRƯỞNG|TEN_NGUOI_KY|TRƯỞNG\s*KHOA|CỐ\s*VẤN/i;

const isOfficialSignTitleParagraph = (paragraph) => {
  const text = paragraphPlainText(paragraph);
  if (!text) return false;
  if (/Trường\s*Đại\s*học|CỘNG\s*HÒA|Xác nhận|Ý kiến|Phê duyệt|Người làm đơn/i.test(text)) {
    return false;
  }
  return SIGN_TITLE_HINT.test(text) || /^HIỆU\s*TRƯỞNG$/i.test(text);
};

const looksLikeSignerName = (text) => {
  const value = String(text || '').trim();
  if (!value || value.length > 60) return false;
  if (/[:/]/.test(value)) return false;
  if (/Cần\s*Thơ|ngày|tháng|năm|HIỆU|TRƯỞNG|KHOA|Sinh viên|CỘNG\s*HÒA/i.test(value)) {
    return false;
  }
  if (/^\{\w+\}$/.test(value)) return true;
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 6 && /^[\p{L}\s.'’-]+$/u.test(value);
};

const isCanThoDateParagraph = (paragraph) => {
  const text = paragraphPlainText(paragraph);
  return /Cần\s*Thơ/i.test(text) && /ngày/i.test(text);
};

/**
 * Gom khối ký vào bảng 1 cột jc=right → nằm nửa phải trang (kể cả LibreOffice).
 */
const layoutOfficialSignColumn = (xml) => {
  const paraRe = /<w:p\b[\s\S]*?<\/w:p>/g;
  const matches = [...xml.matchAll(paraRe)];
  if (!matches.length) return xml;

  const paras = matches.map((m) => m[0]);
  const inBlock = new Array(paras.length).fill(false);
  const role = new Array(paras.length).fill('');
  /** @type {Array<{ start: number, end: number }>} */
  const ranges = [];

  for (let i = 0; i < paras.length; i += 1) {
    if (inBlock[i]) continue;
    const isTitle = isOfficialSignTitleParagraph(paras[i]);
    if (!isTitle) continue;
    const indentMatch = paras[i].match(/<w:ind\b[^>]*w:left="(\d+)"/);
    const sampleIndent = Boolean(indentMatch && Number(indentMatch[1]) >= 4000);

    inBlock[i] = true;
    role[i] = 'title';
    let start = i;
    let end = i;

    if (activeNvqs) {
      const between = [];
      for (let k = i - 1; k >= 0 && !inBlock[k] && between.length <= 2; k -= 1) {
        const previous = paragraphPlainText(paras[k]);
        if (!previous) {
          between.push(k);
          continue;
        }
        if (isCanThoDateParagraph(paras[k])) {
          inBlock[k] = true;
          role[k] = 'date';
          start = k;
          for (const idx of between) {
            inBlock[idx] = true;
            role[idx] = 'skip';
          }
        }
        break;
      }
    }

    for (let j = i + 1; j < paras.length; j += 1) {
      const text = paragraphPlainText(paras[j]);
      if (isCanThoDateParagraph(paras[j])) {
        inBlock[j] = true;
        role[j] = 'date';
        end = j;
        continue;
      }
      if (isOfficialSignTitleParagraph(paras[j])) {
        inBlock[j] = true;
        role[j] = 'title';
        end = j;
        continue;
      }
      if (!text) {
        inBlock[j] = true;
        role[j] = 'spacer';
        end = j;
        continue;
      }
      if (looksLikeSignerName(text)) {
        inBlock[j] = true;
        role[j] = 'name';
        end = j;
        continue;
      }
      break;
    }
    ranges.push({ start, end, sampleIndent });
  }

  if (!ranges.length) return xml;

  const replaceAt = new Map();
  for (const range of ranges) {
    const parts = [];
    let spacerCount = 0;
    // Linux phóng chữ giấy xác nhận ~7/4 nên 3 dòng trống đẩy cả khối ký sang trang 2.
    const maxSpacers = LINUX_PDF && isNvqsDeferralSheet(xml) ? 1 : 3;
    const titlePr = activeNvqs || !range.sampleIndent ? SIGN_INNER_PPR : SIGN_LEFT_PPR;
    for (let i = range.start; i <= range.end; i += 1) {
      const text = paragraphPlainText(paras[i]);
      if (role[i] === 'skip') continue;
      if (role[i] === 'date') {
        parts.push(makeInnerParagraph(text, { italic: true, size: activeSignSz }, titlePr));
      } else if (role[i] === 'title') {
        parts.push(makeInnerParagraph(text, { bold: true, size: activeSignSz }, titlePr));
      } else if (role[i] === 'spacer') {
        if (spacerCount < maxSpacers) {
          parts.push(makeInnerParagraph('', {}, activeNvqs || !range.sampleIndent ? SIGN_INNER_SPACER_PPR : SIGN_LEFT_PPR));
          spacerCount += 1;
        }
      } else if (role[i] === 'name') {
        while (spacerCount < maxSpacers) {
          parts.push(makeInnerParagraph('', {}, activeNvqs || !range.sampleIndent ? SIGN_INNER_SPACER_PPR : SIGN_LEFT_PPR));
          spacerCount += 1;
        }
        parts.push(makeInnerParagraph(text, { bold: true, size: activeSignSz }, titlePr));
      }
    }
    // Giấy tạm hoãn: cột đủ "Cần Thơ, ngày 04 tháng 10 năm 2026" cỡ 13, vẫn nằm nửa phải.
    const colW = activeNvqs ? 4600 : range.sampleIndent ? 4080 : 7800;
    replaceAt.set(range.start, buildRightSignTable(parts.join(''), colW));
    for (let i = range.start + 1; i <= range.end; i += 1) {
      replaceAt.set(i, '');
    }
  }

  let index = 0;
  return xml.replace(paraRe, () => {
    const current = index;
    index += 1;
    if (replaceAt.has(current)) return replaceAt.get(current);
    return paras[current];
  });
};

/**
 * Left CTUT letterhead must be 3 lines (official layout):
 *   UBND THÀNH PHỐ CẦN THƠ
 *   TRƯỜNG ĐẠI HỌC
 *   KỸ THUẬT - CÔNG NGHỆ CẦN THƠ
 * Templates often keep UBND + TRƯỜNG in one paragraph (Word wraps by cell width);
 * LibreOffice keeps them on one line after font boost.
 */
const fixAgencyLetterheadLines = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (!/UBND/i.test(text) || !/TRƯỜNG\s*ĐẠI\s*HỌC/i.test(text)) return paragraph;
    // Already split into separate paragraphs elsewhere — only act when both share this p.
    if (!/UBND[\s\S]{0,80}TRƯỜNG\s*ĐẠI\s*HỌC/i.test(text.replace(/\s+/g, ' '))) {
      return paragraph;
    }

    const openMatch = paragraph.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    let pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    if (!/<w:jc\b/i.test(pPr)) {
      pPr = pPr.includes('</w:pPr>')
        ? pPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>')
        : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    }

    // Soft break → hard paragraph (Shift+Enter in Word).
    if (/<w:br\b/i.test(paragraph)) {
      const withoutOuter = paragraph.slice(open.length, -'</w:p>'.length);
      const pieces = withoutOuter.split(/<w:br\b[^/]*\/>|<w:br\b[^>]*>\s*<\/w:br>/i);
      if (pieces.length >= 2) {
        return pieces
          .map((piece) => piece.trim())
          .filter(Boolean)
          .map((piece, index) => {
            let body = piece;
            if (index > 0 && !/^<w:pPr\b|^<w:r\b/.test(body) && body.includes('<w:t')) {
              body = `<w:r>${body}`;
            }
            if (index > 0 && !body.includes('<w:r')) {
              body = `<w:r>${body}</w:r>`;
            }
            if (index < pieces.length - 1 && body.includes('<w:r') && !/<\/w:r>\s*$/.test(body)) {
              body = `${body}</w:r>`;
            }
            const chunk =
              index === 0 && pPrMatch && body.startsWith(pPrMatch[0])
                ? body
                : `${index === 0 ? (pPrMatch ? pPrMatch[0] : '') : pPr}${body}`;
            return `${open}${chunk}</w:p>`;
          })
          .join('')
          .replace(/(<w:t\b[^>]*>)\s+(TRƯỜNG\s*ĐẠI\s*HỌC)/i, '$1$2');
      }
    }

    // Adjacent runs: UBND…</w:t></w:r><w:r>…TRƯỜNG ĐẠI HỌC
    const adjacent = paragraph.replace(
      /(UBND[^<]*<\/w:t>\s*<\/w:r>)\s*(<w:r\b[\s\S]*?<w:t\b[^>]*>\s*TRƯỜNG\s*ĐẠI\s*HỌC)/i,
      `$1</w:p>${open}${pPr}$2`,
    );
    if (adjacent !== paragraph) {
      return adjacent.replace(/(<w:t\b[^>]*>)\s+(TRƯỜNG\s*ĐẠI\s*HỌC)/i, '$1$2');
    }

    // Same text node: "UBND … CẦN THƠ TRƯỜNG ĐẠI HỌC"
    return paragraph.replace(
      /(<w:t\b[^>]*>)([^<]*UBND[^<]*CẦN\s*THƠ)\s+(TRƯỜNG\s*ĐẠI\s*HỌC[^<]*)(<\/w:t>)(\s*<\/w:r>)?/i,
      (
        _m,
        tOpen,
        ubnd,
        truong,
        tClose,
        rClose = '</w:r>',
      ) =>
        `${tOpen}${ubnd}${tClose}${rClose || '</w:r>'}</w:p>${open}${pPr}` +
        `<w:r><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>` +
        `<w:t>${truong}</w:t></w:r>`,
    );
  });

/**
 * Convert soft line breaks (Shift+Enter) between quốc hiệu and "ĐƠN ..." into hard
 * paragraph breaks. LibreOffice often treats mid-run <w:br/> as spaces, producing
 * "Hạnh phúc ĐƠN" on one line and "XIN ..." on the next.
 *
 * Also repairs the student-card Word template which splits "Hạnh phúc" as:
 *   <w:t>Hạnh phú</w:t> ... <w:t>c ĐƠN</w:t>
 */
const splitMottoFromTitle = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const hasDon = /ĐƠN/i.test(paragraph);
    const hasPhuc =
      /Hạnh\s*phúc/i.test(paragraph) ||
      (/Hạnh\s*phú/i.test(paragraph) && /c\s*ĐƠN/i.test(paragraph));
    if (!hasDon || !hasPhuc) {
      return paragraph;
    }

    const openMatch = paragraph.match(/^<w:p\b[^>]*>/);
    const open = openMatch ? openMatch[0] : '<w:p>';
    const pPrMatch = paragraph.match(/<w:pPr\b[\s\S]*?<\/w:pPr>|<w:pPr\b[^/]*\/>/);
    const pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="center"/></w:pPr>';
    let centeredPPr = pPr.includes('w:jc')
      ? pPr
      : pPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
    // Title paragraph should not inherit motto underline from style-heavy pPr copy;
    // keep alignment/spacing but drop underline in rPr defaults if present later.
    if (!centeredPPr.includes('w:jc')) {
      centeredPPr = centeredPPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
    }

    let working = paragraph;

    // Fix broken "Hạnh phú" + "c ĐƠN" runs from the card template.
    if (/Hạnh\s*phú<\/w:t>/i.test(working) && /<w:t\b[^>]*>c ĐƠN/i.test(working)) {
      working = working
        .replace(/(<w:t\b[^>]*>)([^<]*Hạnh\s*phú)(<\/w:t>)/i, '$1$2c$3')
        .replace(/(<w:t\b[^>]*>)c (ĐƠN)/i, '$1$2');
    }

    // Soft break between motto and title (often inside the same run).
    if (/<w:br\b/i.test(working)) {
      const withoutOuter = working.slice(open.length, -'</w:p>'.length);
      const pieces = withoutOuter.split(/<w:br\b[^/]*\/>|<w:br\b[^>]*>\s*<\/w:br>/i);
      if (pieces.length >= 2) {
        return pieces
          .map((piece) => piece.trim())
          .filter(Boolean)
          .map((piece, index) => {
            let body = piece;
            if (index > 0 && !/^<w:pPr\b|^<w:r\b/.test(body) && body.includes('<w:t')) {
              body = `<w:r>${body}`;
            }
            if (index > 0 && !body.includes('<w:r')) {
              body = `<w:r>${body}</w:r>`;
            }
            if (index < pieces.length - 1 && body.includes('<w:r') && !/<\/w:r>\s*$/.test(body)) {
              body = `${body}</w:r>`;
            }
            const chunk =
              index === 0 && pPrMatch && body.startsWith(pPrMatch[0])
                ? body
                : `${index === 0 ? (pPrMatch ? pPr : '') : centeredPPr}${body}`;
            return `${open}${chunk}</w:p>`;
          })
          .join('');
      }
    }

    // Same text node: "Hạnh phúc ĐƠN XIN ..."
    const sameText = working.replace(
      /(<w:t\b[^>]*>)([^<]*Hạnh\s*phúc)\s+(ĐƠN[^<]*)(<\/w:t>)/i,
      `$1$2$4</w:r></w:p>${open}${centeredPPr}<w:r>$1$3$4`,
    );
    if (sameText !== working) return sameText;

    // Adjacent runs: ...Hạnh phúc</w:t></w:r><w:r><w:t>ĐƠN...
    return working.replace(
      /(Hạnh\s*phúc<\/w:t>\s*<\/w:r>)\s*(<w:r\b[^>]*>\s*<w:t\b[^>]*>\s*ĐƠN)/i,
      `$1</w:p>${open}${centeredPPr}$2`,
    );
  });

const keepOfficialSignIndent = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!isOfficialSignTitleParagraph(paragraph)) return paragraph;
    let next = paragraph.replace(/<w:ind\b[^>]*\/>/g, (tag) => {
      const left = tag.match(/w:left="(\d+)"/);
      if (!left) return tag;
      return `<w:ind w:left="${left[1]}"/>`;
    });
    next = next.replace(/<w:r\b[^>]*>\s*<w:rPr\b[\s\S]*?<\/w:rPr>\s*<w:tab\/>\s*<\/w:r>/g, '');
    next = next.replace(/<w:tab\/>/g, '');
    return next;
  });

const isOfficialConfirmation = (xml) =>
  /GIẤY\s*XÁC\s*NHẬN/i.test(xml) && /KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i.test(xml);

/**
 * Giấy tạm hoãn có quốc hiệu hai cột và khối "HIỆU TRƯỞNG".
 * Giấy hoàn cảnh cũng là "GIẤY XÁC NHẬN" nhưng không có khối đó — không phóng 7/4.
 */
const isNvqsDeferralSheet = (xml) =>
  isOfficialConfirmation(xml) && /HIỆU\s*TRƯỞNG/i.test(xml);

const bannerParagraph = (text, { size, bold = false, underline = false }) =>
  `<w:p><w:pPr>` +
  `<w:spacing w:before="0" w:after="40" w:line="276" w:lineRule="auto"/>` +
  `<w:jc w:val="center"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `</w:pPr>${timesRun(text, { bold, underline, size })}</w:p>`;

/**
 * Đơn xin dính khẩu hiệu và tên đơn trong một đoạn style lớn, thụt hai bên.
 * LibreOffice bẻ từng chữ ("LẠI", "NGHỈ HỌC", "SINH VIÊN") và "NAM" rơi dòng.
 * Viết lại thành ba dòng giữa, không style, không thụt.
 */
const normalizePetitionBanner = (xml) => {
  const plain = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/UBND/i.test(plain) && /CỘNG\s*HÒA/i.test(plain)) return xml;
  if (!/ĐƠN\s*XIN/i.test(plain)) return xml;
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    let text = paragraphPlainText(paragraph)
      .replace(/Hạnh\s*phú\s*c/gi, 'Hạnh phúc')
      .replace(/Hạnh\s*phúc(?=\s*ĐƠN)/gi, 'Hạnh phúc ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) return paragraph;
    const titleMatch = text.match(/ĐƠN\s+XIN\s+[\p{L}\d\s]+/u);
    const hasNation = /^CỘNG\s*HÒA\b/i.test(text);
    const hasMotto = /Độc\s*lập\s*-\s*Tự\s*do\s*-\s*Hạnh\s*phúc/i.test(text);
    if (!hasNation && !hasMotto && !titleMatch) return paragraph;
    // Câu trong thân đơn ("làm đơn này"…) không phải tiêu đề.
    if (titleMatch && /[.!?]/.test(text) && !hasMotto && !hasNation) return paragraph;
    const parts = [];
    if (hasNation) {
      parts.push(bannerParagraph('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { size: '26', bold: true }));
    }
    if (hasMotto) {
      parts.push(
        bannerParagraph('Độc lập - Tự do - Hạnh phúc', { size: '28', bold: true, underline: true }),
      );
    }
    if (titleMatch) {
      const title = titleMatch[0].replace(/\s+/g, ' ').trim();
      parts.push(bannerParagraph(title, { size: '32', bold: true }));
    }
    return parts.join('');
  });
};

/**
 * "Kính gửi: … Tôi tên:" đang cùng một đoạn nên dòng tên dính vào lời gửi.
 */
/** Thụt trái/phải lớn làm "Cần Thơ" hoặc tên đơn rơi một mình. */
const relaxPetitionIndents = (xml) => {
  const plain = xml.replace(/<[^>]+>/g, ' ');
  if (!/ĐƠN\s*XIN/i.test(plain)) return xml;
  if (/UBND/i.test(plain) && /CỘNG\s*HÒA/i.test(plain)) return xml;
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (/HIỆU\s*TRƯỞNG|Người\s*làm\s*đơn/i.test(paragraphPlainText(paragraph))) return paragraph;
    return paragraph.replace(/<w:ind\b[^>]*\/>/g, (tag) => {
      const left = Number((tag.match(/w:left="(\d+)"/) || [])[1] || 0);
      const right = Number((tag.match(/w:right="(\d+)"/) || [])[1] || 0);
      if (left < 1500 && left + right < 2500) return tag;
      return tag
        .replace(/w:left="\d+"/, 'w:left="0"')
        .replace(/w:right="\d+"/, 'w:right="0"')
        .replace(/w:firstLine="\d+"/, 'w:firstLine="0"');
    });
  });
};

const ZERO_CELL_MAR =
  '<w:tblCellMar>' +
  '<w:top w:w="0" w:type="dxa"/>' +
  '<w:left w:w="0" w:type="dxa"/>' +
  '<w:bottom w:w="0" w:type="dxa"/>' +
  '<w:right w:w="0" w:type="dxa"/>' +
  '</w:tblCellMar>';

const ensureZeroCellMar = (table) => {
  if (/<w:tblCellMar\b/.test(table)) {
    return table.replace(/<w:tblCellMar\b[\s\S]*?<\/w:tblCellMar>/, ZERO_CELL_MAR);
  }
  if (/<\/w:tblPr>/.test(table)) {
    return table.replace(/<\/w:tblPr>/, `${ZERO_CELL_MAR}</w:tblPr>`);
  }
  return table;
};

const centeredLine = (text, size, { bold = false, underline = false, after = '0' } = {}) =>
  `<w:p><w:pPr>` +
  `<w:spacing w:before="0" w:after="${after}" w:line="240" w:lineRule="auto"/>` +
  `<w:jc w:val="center"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `</w:pPr>${timesRun(text, { bold, underline, size })}</w:p>`;

const fixedColumnTable = (colWidths, cellInners) => {
  const sum = colWidths.reduce((total, width) => total + width, 0);
  const cells = cellInners
    .map(
      (inner, index) =>
        `<w:tc><w:tcPr>` +
        `<w:tcW w:w="${colWidths[index]}" w:type="dxa"/>` +
        `<w:vAlign w:val="top"/>` +
        `</w:tcPr>${inner}</w:tc>`,
    )
    .join('');
  return (
    `<w:tbl><w:tblPr>` +
    `<w:tblW w:w="${sum}" w:type="dxa"/>` +
    `<w:tblInd w:w="0" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>` +
    `<w:insideH w:val="nil"/><w:insideV w:val="nil"/>` +
    `</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    ZERO_CELL_MAR +
    `</w:tblPr>` +
    `<w:tblGrid>${colWidths.map((width) => `<w:gridCol w:w="${width}"/>`).join('')}</w:tblGrid>` +
    `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>` +
    `</w:tbl>`
  );
};

const mapOutsideTables = (xml, rewrite) => {
  const apply = (segment) => {
    const chunks = segment.split(/(<w:tbl\b[\s\S]*?<\/w:tbl>)/);
    return chunks
      .map((chunk) => (chunk.startsWith('<w:tbl') ? chunk : rewrite(chunk)))
      .join('');
  };
  if (!/<w:body\b/.test(xml)) return xml;
  return xml.replace(
    /(<w:body\b[^>]*>)([\s\S]*?)(<\/w:body>)/,
    (_match, open, body, close) => `${open}${apply(body)}${close}`,
  );
};

/**
 * Giấy hoàn cảnh đặt quốc hiệu bằng tab giữa, nên "Hạnh phúc" rơi xuống
 * cùng hàng với tên trường. Tách thành bảng 2 cột cố định: tên trường trái,
 * quốc hiệu phải.
 */
const promoteTabbedLetterhead = (xml) => {
  if (activeNvqs) return xml;
  return mapOutsideTables(xml, (segment) => {
    const paras = [...segment.matchAll(/<w:p\b[\s\S]*?<\/w:p>/g)];
    if (!paras.length) return segment;
    let result = '';
    let cursor = 0;
    for (let i = 0; i < paras.length; i += 1) {
      const text = paragraphPlainText(paras[i][0]);
      if (!(/UBND/i.test(text) && /CỘNG\s*HÒA/i.test(text))) continue;
      const group = [paras[i][0]];
      let last = i;
      let j = i + 1;
      while (j < paras.length) {
        const nextText = paragraphPlainText(paras[j][0]);
        if (!nextText) {
          j += 1;
          continue;
        }
        const paired =
          /TRƯỜNG\s*ĐẠI\s*HỌC/i.test(nextText) && /Độc\s*lập/i.test(nextText);
        const school = /^KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i.test(nextText);
        if (!paired && !school) break;
        group.push(paras[j][0]);
        last = j;
        j += 1;
      }
      const left = [];
      const right = [];
      group.forEach((paragraph) => {
        const bits = paragraph
          .split(/<w:tab\/>/)
          .map((bit) => paragraphPlainText(bit))
          .map((bit) => bit.trim())
          .filter(Boolean);
        if (bits.length >= 2) {
          left.push(bits[0]);
          right.push(bits.slice(1).join(' '));
        } else if (bits.length === 1) {
          left.push(bits[0]);
        }
      });
      if (!left.length || !right.length) continue;
      const leftW = 4520;
      const rightW = MAX_TABLE_WIDTH - leftW;
      const table = fixedColumnTable(
        [leftW, rightW],
        [
          left.map((line) => centeredLine(line, headerLetterSz, { bold: !/^UBND\b/i.test(line) })).join(''),
          right
            .map((line) =>
              centeredLine(line, /Độc\s*lập/i.test(line) ? headerDocLapSz : headerLetterSz, {
                bold: true,
              }),
            )
            .join(''),
        ],
      );
      const start = paras[i].index;
      const end = paras[last].index + paras[last][0].length;
      result += segment.slice(cursor, start) + table;
      cursor = end;
      i = last;
    }
    return result + segment.slice(cursor);
  });
};

const tabPieces = (paragraph) =>
  paragraph
    .split(/<w:tab\/>/)
    .map((bit) => paragraphPlainText(bit))
    .map((bit) => bit.trim())
    .filter(Boolean);

const isAlignableFieldParagraph = (paragraph) => {
  if (!/<w:tab\/>/.test(paragraph)) return false;
  const text = paragraphPlainText(paragraph);
  if (!text || text.length > 220) return false;
  if (/Cần\s*Thơ,\s*ngày|Ý kiến|Người làm đơn|Phê duyệt|Xác nhận của|UBND|CỘNG\s*HÒA|Độc\s*lập|GIẤY\s*XÁC\s*NHẬN|Kính\s*gửi/i.test(text)) {
    return false;
  }
  const pieces = tabPieces(paragraph);
  return pieces.length >= 2 && pieces.length <= 3 && pieces.every((piece) => piece.length <= 80);
};

/**
 * Mỗi dòng "Nhãn trái <tab> Nhãn phải" đang rơi vào tab mặc định 720 twip
 * nên cột phải lệch nhau. Bảng 2 cột cố định giữ một mép trái chung.
 * Không đụng giấy tạm hoãn — cột đó đã canh tại 5040 twip.
 */
const alignBodyFieldColumns = (xml) => {
  if (activeNvqs) return xml;
  const leftW = 6000;
  const rest = MAX_TABLE_WIDTH - leftW;
  return mapOutsideTables(xml, (segment) =>
    segment.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (!isAlignableFieldParagraph(paragraph)) return paragraph;
      const pieces = tabPieces(paragraph);
      const widths =
        pieces.length === 2
          ? [leftW, rest]
          : [leftW, Math.round(rest / (pieces.length - 1)), rest - Math.round(rest / (pieces.length - 1)) * (pieces.length - 2)];
      const fieldLine = (value) =>
        `<w:p><w:pPr>` +
        `<w:spacing w:before="0" w:after="40" w:line="276" w:lineRule="auto"/>` +
        `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
        `</w:pPr>${timesRun(value, { size: activeBodySz })}</w:p>`;
      return fixedColumnTable(widths, pieces.map(fieldLine));
    }),
  );
};

const forceParagraphCenter = (paragraph) => {
  let next = paragraph.replace(
    /<w:ind\b[^>]*\/>/g,
    '<w:ind w:left="0" w:right="0" w:firstLine="0"/>',
  );
  if (/<w:jc\b/.test(next)) {
    return next.replace(/<w:jc\b[^>]*\/>/, '<w:jc w:val="center"/>');
  }
  if (/<\/w:pPr>/.test(next)) {
    return next.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
  }
  return next.replace(/<w:p\b([^>]*)>/, '<w:p$1><w:pPr><w:jc w:val="center"/></w:pPr>');
};

const applyColumnWidths = (table, widths) => {
  let colIndex = 0;
  let next = table.replace(/<w:noWrap\/>/g, '').replace(/<w:tcW\b[^>]*\/>/g, (tcW) => {
    const width = widths[colIndex % widths.length];
    colIndex += 1;
    return tcW.replace(/w:w="\d+"/, `w:w="${width}"`);
  });
  const sum = widths.reduce((total, width) => total + width, 0);
  if (/<w:tblW\b/.test(next)) {
    next = next.replace(/<w:tblW\b[^>]*\/>/, `<w:tblW w:w="${sum}" w:type="dxa"/>`);
  }
  next = ensureZeroCellMar(next);
  next = syncTblGridToWidths(next, widths);
  return next.replace(/<w:vAlign w:val="[^"]+"\/>/g, '<w:vAlign w:val="top"/>');
};

/**
 * Bảng ký đơn xin: dòng ngày nằm cùng hàng với "Ý kiến" và "Người làm đơn"
 * vì ô phải hẹp + noWrap làm chữ tràn sang trái. Nới ô ngày, căn giữa trong ô,
 * và chia đều hàng "Ý kiến của …".
 */
const replaceBalancedTables = (xml, rewrite) => {
  let result = '';
  let cursor = 0;
  const openRe = /<w:tbl\b/g;
  let match = openRe.exec(xml);
  while (match) {
    if (match.index < cursor) {
      match = openRe.exec(xml);
      continue;
    }
    let depth = 1;
    let pos = match.index + match[0].length;
    const findOpen = (from) => {
      const re = /<w:tbl\b/g;
      re.lastIndex = from;
      const found = re.exec(xml);
      return found ? found.index : -1;
    };
    while (depth > 0 && pos < xml.length) {
      const nextOpen = findOpen(pos);
      const nextClose = xml.indexOf('</w:tbl>', pos);
      if (nextClose < 0) return xml;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth += 1;
        pos = nextOpen + 6;
      } else {
        depth -= 1;
        pos = nextClose + '</w:tbl>'.length;
      }
    }
    result += xml.slice(cursor, match.index) + rewrite(xml.slice(match.index, pos));
    cursor = pos;
    openRe.lastIndex = pos;
    match = openRe.exec(xml);
  }
  return result + xml.slice(cursor);
};

const layoutPetitionSignTables = (xml) => {
  if (activeNvqs) return xml;
  return replaceBalancedTables(xml, (table) => {
    if (/UBND/i.test(table) && /CỘNG\s*HÒA/i.test(table)) return table;
    if (/HIỆU\s*TRƯỞNG/i.test(table)) return table;
    const rows = table.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    if (!rows.length) return table;
    const firstCells = rows[0].match(/<w:tc\b[\s\S]*?<\/w:tc>/g) || [];
    const columnCount = firstCells.length;
    if (columnCount < 2 || columnCount > 3) return table;
    const allText = paragraphPlainText(table);
    const signTable =
      /Ý kiến|Người làm đơn|Phê duyệt|Xác nhận/i.test(allText) &&
      (/Cần\s*Thơ/i.test(allText) || /Ý kiến/i.test(allText));
    if (!signTable) return table;

    let widths;
    if (columnCount === 3) {
      widths = [3360, 3360, 3360];
    } else if (/Ý kiến của phụ huynh/i.test(allText)) {
      widths = [4400, 5680];
    } else if (/Phê duyệt/i.test(allText) && /Ngân hàng/i.test(allText)) {
      // Cột trái chứa "Trường Đại học Kỹ thuật - Công nghệ Cần Thơ".
      widths = [6200, 3880];
    } else {
      widths = [5040, 5040];
    }

    let next = applyColumnWidths(table, widths);
    next = next.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      const text = paragraphPlainText(paragraph);
      if (!text) return paragraph;
      const isDate = /Cần\s*Thơ/i.test(text) && /ngày/i.test(text);
      const isLabel = /Ý kiến|Người làm đơn|Xác nhận|Phê duyệt/i.test(text);
      if (!isDate && !isLabel) return paragraph;
      let updated = forceParagraphCenter(paragraph);
      if (isDate && widths[widths.length - 1] <= 4000) {
        updated = setRunSizesInParagraph(updated, '22');
      }
      if (isDate && /<\/w:pPr>/.test(updated) && !/w:after="120"/.test(updated)) {
        if (/w:after="\d+"/.test(updated)) {
          updated = updated.replace(/w:after="\d+"/, 'w:after="120"');
        } else {
          updated = updated.replace(
            /<\/w:pPr>/,
            '<w:spacing w:before="0" w:after="120" w:line="276" w:lineRule="auto"/></w:pPr>',
          );
        }
      }
      return updated;
    });
    return next;
  });
};

/**
 * Giữ "Cần Thơ" / "Khởi nghiệp" cùng một dòng. Mẫu cấp thẻ tách "Cần" và "Thơ"
 * ở hai thẻ w:t nên gộp cả đoạn rồi mới gắn NBSP.
 */
const gluePlaceNames = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const raw = [...paragraph.matchAll(/<w:t\b[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!/Cần\s*Thơ|Khởi\s*nghiệp/.test(raw)) return paragraph;
    const glued = raw
      .replace(/Cần\s*Thơ/g, 'Cần\u00A0Thơ')
      .replace(/Khởi\s*nghiệp/g, 'Khởi\u00A0nghiệp');
    if (glued === raw) return paragraph;
    let used = false;
    return paragraph.replace(/<w:t\b([^>]*)>([^<]*)<\/w:t>/g, (_full, attrs) => {
      if (used) return `<w:t${attrs}></w:t>`;
      used = true;
      return `<w:t xml:space="preserve">${escapeXml(glued)}</w:t>`;
    });
  });

/** Dòng phê duyệt "Trường … Cần Thơ" / tên ngân hàng vừa cột khi còn 12pt. */
const shrinkLongApprovalLines = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    if (!/^(?:Phê duyệt|Trường Đại học Kỹ thuật|Xác nhận của Ngân)/i.test(text)) return paragraph;
    if (/trân trọng|đơn này|kính|cho phép|xác\s*nhận\s*:/i.test(text)) return paragraph;
    return setRunSizesInParagraph(paragraph, '24');
  });

/** Đoạn trống mang style lớn (khoảng cách trước tên đơn) tạo một lỗ giữa khẩu hiệu và tiêu đề. */
const dropStyledEmptyParagraphs = (xml) => {
  const plain = xml.replace(/<[^>]+>/g, ' ');
  if (!/ĐƠN\s*XIN/i.test(plain)) return xml;
  return mapOutsideTables(xml, (segment) =>
    segment.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (paragraphPlainText(paragraph)) return paragraph;
      if (!/<w:pStyle\b/.test(paragraph)) return paragraph;
      return '';
    }),
  );
};

const splitGreetingFromName = (xml) =>
  xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    const match = text.match(/^(Kính\s*gửi\s*:?\s*.+?)\s+(Tôi\s*tên\s*:?\s*.+)$/i);
    if (!match) return paragraph;
    const pPr =
      `<w:pPr><w:spacing w:before="80" w:after="40" w:line="276" w:lineRule="auto"/>` +
      `<w:ind w:left="0" w:right="0" w:firstLine="0"/></w:pPr>`;
    const line = (value, center) =>
      `<w:p>${pPr.replace(
        '</w:pPr>',
        center ? '<w:jc w:val="center"/></w:pPr>' : '</w:pPr>',
      )}${timesRun(value, { size: activeBodySz })}</w:p>`;
    const name = match[2].trim();
    // \b không nhận chữ có dấu (ố) nên "Mã số" không khớp.
    const nameSplit = name.split(/\s+(?=Mã\s*số|MSSV)/i);
    const nameParagraph = nameSplit.length === 2
      ? `<w:p>${pPr}${timesRun(nameSplit[0].trim(), { size: activeBodySz })}` +
        `<w:r><w:tab/></w:r>${timesRun(nameSplit[1].trim(), { size: activeBodySz })}</w:p>`
      : line(name, false);
    return line(match[1].trim(), true) + nameParagraph;
  });

/**
 * Linux dùng cỡ chữ lớn hơn để bù phần co trang. Giãn dòng gốc làm khối ký
 * không còn chỗ ở trang 1. Siết về một dòng, giữ dòng trống dành cho chữ ký.
 */
const compactOfficialLineSpacing = (xml) => {
  if (!LINUX_PDF || !isNvqsDeferralSheet(xml)) return xml;
  const spacing = '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>';
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!paragraphPlainText(paragraph)) return paragraph;
    const isParagraphSpacing = (tag) => /w:before=|w:after=|w:line=/.test(tag);
    const tags = [...paragraph.matchAll(/<w:spacing\b[^>]*\/>/g)].map((match) => match[0]);
    if (tags.some(isParagraphSpacing)) {
      return paragraph.replace(/<w:spacing\b[^>]*\/>/g, (tag) =>
        isParagraphSpacing(tag) ? spacing : tag,
      );
    }
    if (/<w:pPr\b/.test(paragraph)) {
      return paragraph.replace(/<w:pPr\b([^>]*)>/, `<w:pPr$1>${spacing}`);
    }
    return paragraph.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr>${spacing}</w:pPr>`);
  });
};

/**
 * Gạch chân font cắt dấu nặng. Thêm một dòng gạch riêng, kéo lên sát
 * nhưng vẫn nằm dưới dấu nặng, dài theo số nét chứ không hết cột.
 */
const nvqsRuleParagraph = (count) =>
  `<w:p><w:pPr><w:jc w:val="center"/>` +
  `<w:spacing w:before="0" w:after="0" w:line="60" w:lineRule="exact"/>` +
  `<w:ind w:left="0" w:right="0" w:firstLine="0"/>` +
  `</w:pPr><w:r><w:rPr>` +
  `<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/>` +
  `<w:sz w:val="16"/><w:szCs w:val="16"/>` +
  `</w:rPr><w:t>${'_'.repeat(count)}</w:t></w:r></w:p>`;

const lowerNvqsUnderlines = (xml) => {
  if (!activeNvqs) return xml;
  const lines = [
    { test: /^Độc\s*lập\b/i, count: 39 },
    { test: /^KỸ\s*THUẬT\s*-\s*CÔNG\s*NGHỆ/i, count: 51 },
  ];
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = paragraphPlainText(paragraph);
    const spec = lines.find((item) => item.test.test(text));
    if (!spec) return paragraph;
    const next = paragraph.replace(/<w:u\b[^>]*\/>/g, '').replace(/<w:pBdr\b[\s\S]*?<\/w:pBdr>/g, '');
    return next + nvqsRuleParagraph(spec.count);
  });
};

const normalizeXmlPart = (xml) => {
  activeNvqs = isNvqsDeferralSheet(xml);
  // NĐ 30, bộ 12/13: quốc hiệu 12, tiêu ngữ và ngày tháng 13. Tên giấy 14. Thân 14.
  headerLetterSz = activeNvqs ? fitLinuxShrink(24) : '26';
  headerDocLapSz = activeNvqs ? fitLinuxShrink(26) : '28';
  headerTitleSz = activeNvqs ? fitLinuxShrink(28) : '36';
  activeBodySz = activeNvqs ? String(Number(fitLinuxShrink(28))) : String(BODY_SZ);
  activeSignSz = activeNvqs ? String(Number(fitLinuxShrink(26))) : '26';
  let next = applyFontMap(xml);
  next = forcePrintZoom(next);
  next = stripWideTabStops(next);
  next = promoteTabbedLetterhead(next);
  next = stripLetterheadTabs(next);
  next = clampPageMargins(next);
  next = softenHeaderFontSizes(next);
  next = widenLetterheadCells(next);
  next = widenSignerDateCells(next);
  next = fixAgencyLetterheadLines(next);
  next = fixLetterheadUnderlines(next);
  next = splitMottoFromTitle(next);
  next = normalizePetitionBanner(next);
  next = relaxPetitionIndents(next);
  next = splitGreetingFromName(next);
  next = dropStyledEmptyParagraphs(next);
  next = stripSoftBreaksInDateParagraphs(next);
  next = mergeTrailingYearParagraph(next);
  next = mergeLeadingYearParagraph(next);
  next = keepCanThoDateOnOneLine(next);
  next = keepOfficialSignIndent(next);
  next = layoutOfficialSignColumn(next);
  next = clampOversizedTables(next);
  next = balanceLetterheadColumns(next);
  next = lockTablesAgainstShrink(next);
  next = raiseDocDefaults(next);
  next = stripCondensedCharSpacing(next);
  next = applyOfficialHeaderLayout(next);
  next = fixNationalMottoLine(next);
  next = fixAgencyTechLine(next);
  // Chạy lại sau layout — giữ NBSP để năm không xuống dòng.
  next = keepCanThoDateOnOneLine(next);
  next = layoutPetitionSignTables(next);
  next = gluePlaceNames(next);
  next = applyStandardBodySize(next);
  next = shrinkLongApprovalLines(next);
  next = compactOfficialLineSpacing(next);
  next = stripWideTabStops(next);
  next = alignPairedFieldColumns(next);
  next = alignBodyFieldColumns(next);
  next = forcePrintZoom(next);
  // Mọi run dựng lại cũng phải cùng font đã cài, kể cả chữ ký chèn thêm.
  next = lowerNvqsUnderlines(next);
  next = applyFontMap(next);
  if (activeNvqs && timesFontInstalled()) {
    next = next.replaceAll('Liberation Serif', 'Times New Roman');
  }
  return next;
};

/**
 * Normalize a filled DOCX buffer before LibreOffice PDF export so Windows templates
 * keep letterhead layout on Linux (Liberation fonts + printable width).
 */
export const normalizeDocxForPdfExport = (docxBuffer) => {
  const zip = new PizZip(docxBuffer);
  const names = Object.keys(zip.files).filter(
    (name) =>
      (name.startsWith('word/') && name.endsWith('.xml')) ||
      name === 'docProps/core.xml',
  );

  for (const name of names) {
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const original = entry.asText();
    const updated = normalizeXmlPart(original);
    if (updated !== original) {
      zip.file(name, updated);
    }
  }

  return Buffer.from(zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
};
