import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as XLSXNS from 'xlsx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import LoaiDon from '../importForms/LoaiDon.model.js';
import User from '../users/user.model.js';
import { ensureStudentUserLinked } from '../users/studentProfile.service.js';
import * as workflowService from '../workflows/workflow.service.js';
import { isCloudinaryConfigured } from '../../config/cloudinary.js';
import { uploadPrivateRawBuffer } from '../../shared/storage/privateRawStorage.js';
import { normalizeDocxForPdfExport } from '../convertFileAndSubmit/docxPdfNormalize.js';
import {
  assignSignatureCaptionFields,
  injectSignatureCaptionPlaceholders,
  injectRenderedSignatureCaptions,
  tightenDatePlaceholdersInTemplate,
} from '../convertFileAndSubmit/signatureCaption.js';
import { getTemplateBuffer } from '../convertFileAndSubmit/previewCache.js';
import {
  convertDocxToPdfBuffer,
  convertDocxBatchToPdfBuffers,
  getSofficeCommand,
} from '../convertFileAndSubmit/pdfConvert.js';
import {
  cell,
  isEmptyRow,
  isGuideRow,
  parseExcelRows,
  toRowMap,
  cellRaw,
  formatExcelFormValue,
} from '../organization/importRowUtils.js';
import { NotFoundError, ValidationError } from '../../shared/errors/AppError.js';

const XLSX = XLSXNS.default ?? XLSXNS;

const MAX_IMPORT_ROWS = 40;
const RENDER_CONCURRENCY = 8;
const UPLOAD_CONCURRENCY = 8;

const normalizeHeader = (key) =>
  String(key ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s_-]+/g, '');

/** Bỏ trường ảnh/chữ ký — không import qua Excel text. */
export const isImageOrSignaturePlaceholder = (placeHolder = '') => {
  const raw = String(placeHolder || '').trim();
  if (!raw) return true;
  if (raw.startsWith('%')) return true;
  const upper = raw.toUpperCase();
  return upper.startsWith('CHU_KY') || upper.includes('CHU_KY_');
};

export const getImportableFields = (loaiDon) => {
  const list = Array.isArray(loaiDon?.chiTiet) ? loaiDon.chiTiet : [];
  return list
    .filter((item) => item?.placeHolder && !isImageOrSignaturePlaceholder(item.placeHolder))
    .map((item) => ({
      placeHolder: String(item.placeHolder).trim(),
      moTa: String(item.moTa || item.placeHolder).trim(),
    }));
};

const ensureMssvColumn = (fields) => {
  const hasMssv = fields.some((f) => normalizeHeader(f.placeHolder) === 'mssv');
  if (hasMssv) return fields;
  return [{ placeHolder: 'MSSV', moTa: 'Mã số sinh viên (bắt buộc)' }, ...fields];
};

const buildDocxtemplater = (buffer) => {
  const zip = new PizZip(buffer);
  const imageModule = new ImageModule({
    centered: true,
    getImage(tagValue) {
      return fs.readFileSync(tagValue);
    },
    getSize() {
      return [96, 52];
    },
  });
  return new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    modules: [imageModule],
  });
};

const cleanupTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }
};

/**
 * Import không chờ PDF — trả hồ sơ ngay (DOCX). LibreOffice chuyển PDF nền nếu có.
 * @param {Array<{ fileId: string, publicId: string, originalName: string, docxBuffer: Buffer }>} jobs
 */
const scheduleDocxToPdfUpgrade = (jobs) => {
  if (!jobs?.length || !getSofficeCommand()) return;

  setImmediate(() => {
    void (async () => {
      const tempDir = path.join(process.cwd(), 'temp', `bulk_pdf_${Date.now()}`);
      try {
        await fs.promises.mkdir(tempDir, { recursive: true });
        const withPaths = [];
        for (const job of jobs) {
          const docxPath = path.join(tempDir, `${job.publicId}.docx`);
          await fs.promises.writeFile(docxPath, job.docxBuffer);
          withPaths.push({ ...job, docxPath });
        }

        const pdfByDocx = await convertDocxBatchToPdfBuffers(
          withPaths.map((j) => j.docxPath),
          tempDir,
          12,
        );

        for (const job of withPaths) {
          const pdfBuffer = pdfByDocx.get(path.resolve(job.docxPath));
          if (!pdfBuffer) continue;

          let duongDanFile;
          if (isCloudinaryConfigured()) {
            const upload = await uploadBufferToCloudinary(pdfBuffer, {
              publicId: `${job.publicId}-pdf`,
              format: 'pdf',
            });
            duongDanFile = upload.secure_url;
          } else {
            const keepDir = path.join(process.cwd(), 'uploads', 'generated');
            await fs.promises.mkdir(keepDir, { recursive: true });
            duongDanFile = path.join(keepDir, `bulk_${job.publicId}.pdf`);
            await fs.promises.writeFile(duongDanFile, pdfBuffer);
          }

          await GeneratedFile.updateOne(
            { _id: job.fileId },
            {
              $set: {
                duongDanFile,
                fileMimeType: 'application/pdf',
                originalFileName: String(job.originalName || 'don.docx').replace(/\.docx$/i, '.pdf'),
              },
            },
          );
        }
      } catch (err) {
        console.warn('[bulk-import] Chuyển PDF nền thất bại:', err?.message || err);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    })();
  });
};

const mapPool = async (items, concurrency, worker) => {
  const list = items || [];
  const results = new Array(list.length);
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency || 1, list.length || 1));

  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= list.length) return;
        results[index] = await worker(list[index], index);
      }
    }),
  );

  return results;
};

const uploadBufferToCloudinary = (buffer, { publicId, format }) =>
  uploadPrivateRawBuffer(buffer, {
    folder: 'generated-files',
    publicId,
    format,
  });

const findStudentByMssvOrEmail = async (fields) => {
  const mssv = String(fields.MSSV || fields.mssv || fields.studentId || '').trim();
  if (mssv) {
    const byId = await User.findOne({
      role: 'student',
      $or: [{ studentId: mssv }, { email: mssv.toLowerCase() }],
    });
    if (byId) return byId;
  }

  const email = String(fields.EMAIL || fields.email || fields.submitterEmail || '')
    .trim()
    .toLowerCase();
  if (email) {
    return User.findOne({ role: 'student', email });
  }
  return null;
};

const loadStudentsForRows = async (rowFieldsList) => {
  const mssvSet = new Set();
  const emailSet = new Set();

  for (const fields of rowFieldsList) {
    const mssv = String(fields.MSSV || '').trim();
    const email = String(fields.EMAIL || '')
      .trim()
      .toLowerCase();
    if (mssv) {
      mssvSet.add(mssv);
      mssvSet.add(mssv.toLowerCase());
    }
    if (email) emailSet.add(email);
  }

  const or = [];
  if (mssvSet.size) {
    or.push({ studentId: { $in: [...mssvSet] } });
    or.push({ email: { $in: [...mssvSet].map((v) => v.toLowerCase()) } });
  }
  if (emailSet.size) {
    or.push({ email: { $in: [...emailSet] } });
  }
  if (!or.length) return { byMssv: new Map(), byEmail: new Map() };

  const students = await User.find({ role: 'student', $or: or }).lean(false);
  const byMssv = new Map();
  const byEmail = new Map();
  for (const s of students) {
    if (s.studentId) byMssv.set(String(s.studentId).trim(), s);
    if (s.email) byEmail.set(String(s.email).trim().toLowerCase(), s);
  }
  return { byMssv, byEmail };
};

const resolveStudentFromMaps = (fields, maps) => {
  const mssv = String(fields.MSSV || '').trim();
  if (mssv) {
    if (maps.byMssv.has(mssv)) return maps.byMssv.get(mssv);
    const asEmail = mssv.toLowerCase();
    if (maps.byEmail.has(asEmail)) return maps.byEmail.get(asEmail);
  }
  const email = String(fields.EMAIL || '')
    .trim()
    .toLowerCase();
  if (email && maps.byEmail.has(email)) return maps.byEmail.get(email);
  return null;
};

const prepareTemplateBuffer = async (templateUrl) => {
  const templateBuffer = await getTemplateBuffer(templateUrl);
  let prepared = injectSignatureCaptionPlaceholders(Buffer.from(templateBuffer));
  prepared = tightenDatePlaceholdersInTemplate(prepared);
  return prepared;
};

const renderDocxFromPreparedTemplate = (preparedTemplate, renderFields) => {
  const doc = buildDocxtemplater(Buffer.from(preparedTemplate));
  doc.render(renderFields);
  let docxBuffer = doc.getZip().generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 1 },
  });
  docxBuffer = injectRenderedSignatureCaptions(docxBuffer, renderFields);
  return normalizeDocxForPdfExport(docxBuffer);
};

/**
 * Tạo hồ sơ từ fields + gán submittedBy = sinh viên (không lấy JWT cán bộ).
 * (Đường đơn lẻ — import hàng loạt dùng pipeline nhanh hơn bên dưới.)
 */
export const generateSubmissionForStudent = async ({ loaiDon, fields, actorUserId }) => {
  if (!loaiDon?.templateFile) {
    throw new ValidationError('Mẫu đơn chưa có file Word gốc');
  }

  const student = await findStudentByMssvOrEmail(fields);
  if (!student) {
    throw new ValidationError(
      'Không tìm thấy sinh viên theo MSSV/Email. Kiểm tra cột MSSV đã có trong hệ thống.',
    );
  }

  const renderFields = { ...fields };
  if (!renderFields.HO_TEN && student.fullName) {
    renderFields.HO_TEN = student.fullName;
  }
  if (!renderFields.MSSV && student.studentId) {
    renderFields.MSSV = student.studentId;
  }

  assignSignatureCaptionFields(renderFields, { user: student });

  const tempDir = path.join(process.cwd(), 'temp');
  await fs.promises.mkdir(tempDir, { recursive: true });
  const id = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const docxPath = path.join(tempDir, `bulk_${id}.docx`);
  const pdfPath = path.join(tempDir, `bulk_${id}.pdf`);

  try {
    const prepared = await prepareTemplateBuffer(loaiDon.templateFile);
    const normalizedDocx = renderDocxFromPreparedTemplate(prepared, renderFields);
    await fs.promises.writeFile(docxPath, normalizedDocx);

    let finalBuffer = normalizedDocx;
    let finalMimeType =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    let finalExtension = '.docx';

    const pdfBuffer = getSofficeCommand()
      ? await convertDocxToPdfBuffer(docxPath, tempDir, normalizedDocx)
      : null;
    if (pdfBuffer) {
      await fs.promises.writeFile(pdfPath, pdfBuffer);
      finalBuffer = pdfBuffer;
      finalMimeType = 'application/pdf';
      finalExtension = '.pdf';
    }

    let duongDanFile = pdfPath;
    if (isCloudinaryConfigured()) {
      const uploadResult = await uploadBufferToCloudinary(finalBuffer, {
        publicId: `bulk-${id}`,
        format: finalExtension.replace('.', ''),
      });
      duongDanFile = uploadResult.secure_url;
    } else {
      const localPath = path.join(tempDir, `kept_bulk_${id}${finalExtension}`);
      await fs.promises.writeFile(localPath, finalBuffer);
      duongDanFile = localPath;
    }

    const newFile = await GeneratedFile.create({
      tenDon: loaiDon.tenDon || 'Đơn yêu cầu',
      tenNguoiGui: renderFields.HO_TEN || student.fullName || 'Sinh viên',
      duongDanFile,
      trangThai: 'cho_duyet',
      submittedBy: student._id,
      loaiDonId: loaiDon._id,
      sourceType: 'generated',
      originalFileName: `${loaiDon.tenDon || 'don'}${finalExtension}`,
      fileMimeType: finalMimeType,
    });

    await workflowService.startWorkflowForGeneratedFile(newFile._id, student._id);

    return {
      generatedFileId: newFile._id,
      studentId: student.studentId || '',
      studentName: student.fullName || '',
      actorUserId: actorUserId || null,
    };
  } finally {
    await Promise.allSettled([cleanupTempFile(docxPath), cleanupTempFile(pdfPath)]);
  }
};

export const buildExcelTemplateBuffer = (loaiDon) => {
  const fields = ensureMssvColumn(getImportableFields(loaiDon));
  if (!fields.length) {
    throw new ValidationError('Mẫu đơn không có trường text để import Excel');
  }

  const headers = fields.map((f) => f.placeHolder);
  const guide = fields.map((f) => `[HD] ${f.moTa}`);
  const sample = fields.map((f) => {
    const key = normalizeHeader(f.placeHolder);
    if (key === 'mssv') return '240801001';
    if (key === 'hoten' || key === 'ho_ten') return 'Nguyễn Văn A';
    return '';
  });

  const sheet = XLSX.utils.aoa_to_sheet([headers, guide, sample]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'ImportDon');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

const FIELD_ALIASES = {
  mssv: ['mssv', 'masv', 'masinhvien', 'studentid', 'studentcode', 'masosinhvien', 'msv'],
  email: ['email', 'mail', 'emailsv', 'emailsinhvien'],
  hoten: ['hoten', 'hovaten', 'tensinhvien', 'fullname', 'fullname', 'fullnamestudent'],
  ngaysinh: ['ngaysinh', 'dob', 'birthday', 'dateofbirth'],
  cccd: ['cccd', 'cmnd', 'cancuoc', 'socccd', 'socmnd'],
  lop: ['lop', 'tenlop', 'malop', 'class'],
  khoa: ['khoa', 'tenkhoa', 'faculty'],
  nganh: ['nganh', 'tennganh', 'major'],
};

const aliasGroupFor = (normalizedKey) => {
  for (const [group, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalizedKey) || normalizedKey === group) return group;
  }
  const compact = normalizedKey.replace(/[^a-z0-9]/g, '');
  for (const [group, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(compact) || compact === group) return group;
    if (compact.includes(group) || group.includes(compact)) {
      if (Math.min(compact.length, group.length) >= 4) return group;
    }
  }
  return null;
};

const scoreHeaderToField = (headerNorm, field) => {
  const ph = normalizeHeader(field.placeHolder);
  const moTa = normalizeHeader(field.moTa);
  if (!headerNorm) return 0;
  if (headerNorm === ph) return 100;
  if (moTa && headerNorm === moTa) return 95;
  if (ph && (headerNorm.includes(ph) || ph.includes(headerNorm)) && Math.min(headerNorm.length, ph.length) >= 3) {
    return 70;
  }
  if (moTa && (headerNorm.includes(moTa) || moTa.includes(headerNorm)) && Math.min(headerNorm.length, moTa.length) >= 3) {
    return 60;
  }
  const gHeader = aliasGroupFor(headerNorm);
  const gField = aliasGroupFor(ph) || aliasGroupFor(moTa);
  if (gHeader && gField && gHeader === gField) return 85;
  return 0;
};

/**
 * Tự map cột Excel → placeHolder mẫu đơn (1-1, điểm cao nhất).
 * Excel dư cột / mẫu dư trường đều được — chỉ lấy cặp khớp tốt.
 */
export const buildColumnMapping = (detectedHeaders, importableFields) => {
  const fields = ensureMssvColumn(importableFields);
  const headers = (detectedHeaders || []).filter((h) => String(h || '').trim());

  const candidates = [];
  for (const header of headers) {
    const headerNorm = normalizeHeader(header);
    for (const field of fields) {
      const score = scoreHeaderToField(headerNorm, field);
      if (score > 0) {
        candidates.push({ header, placeHolder: field.placeHolder, score });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score);

  const usedHeaders = new Set();
  const usedFields = new Set();
  /** @type {Record<string, string>} placeHolder -> excel header */
  const mapping = {};

  for (const item of candidates) {
    if (usedHeaders.has(item.header) || usedFields.has(item.placeHolder)) continue;
    if (item.score < 60) continue;
    mapping[item.placeHolder] = item.header;
    usedHeaders.add(item.header);
    usedFields.add(item.placeHolder);
  }

  const matchedPlaceholders = Object.keys(mapping);
  const unmatchedFields = fields
    .map((f) => f.placeHolder)
    .filter((ph) => !mapping[ph]);
  const unmatchedHeaders = headers.filter((h) => !usedHeaders.has(h));

  const hasIdentity =
    Boolean(mapping.MSSV) ||
    Boolean(mapping.EMAIL) ||
    unmatchedHeaders.some((h) => {
      const g = aliasGroupFor(normalizeHeader(h));
      return g === 'mssv' || g === 'email';
    });

  return {
    mapping,
    matchedPlaceholders,
    unmatchedFields,
    unmatchedHeaders,
    hasIdentityColumn: hasIdentity || matchedPlaceholders.some((p) => ['MSSV', 'EMAIL'].includes(p)),
    expectedPlaceholders: fields.map((f) => f.placeHolder),
  };
};

const mapRowToFields = (row, columnMapping) => {
  const map = toRowMap(row);
  const fields = {};

  for (const [placeHolder, excelHeader] of Object.entries(columnMapping.mapping || {})) {
    const raw = cellRaw(map, excelHeader, placeHolder);
    fields[placeHolder] = formatExcelFormValue(raw, placeHolder);
  }

  if (!fields.MSSV) {
    const mssv = cell(map, 'MSSV', 'mssv', 'Ma SV', 'Mã SV', 'studentId', 'Mã sinh viên');
    if (mssv) fields.MSSV = mssv;
  }
  if (!fields.EMAIL) {
    const email = cell(map, 'EMAIL', 'Email', 'email');
    if (email) fields.EMAIL = email;
  }
  if (!fields.HO_TEN) {
    const name = cell(map, 'HO_TEN', 'Ho Ten', 'Họ tên', 'hoten', 'Họ và tên');
    if (name) fields.HO_TEN = name;
  }

  return fields;
};

/**
 * Phân tích header Excel so với mẫu đơn (không chặn import khi thiếu/dư cột).
 */
export const validateExcelHeadersAgainstForm = (detectedHeaders, importableFields) => {
  const built = buildColumnMapping(detectedHeaders, importableFields);
  return {
    missing: built.unmatchedFields,
    unexpected: built.unmatchedHeaders,
    matched: built.matchedPlaceholders,
    mapping: built.mapping,
    hasIdentityColumn: built.hasIdentityColumn,
    expectedPlaceholders: built.expectedPlaceholders,
  };
};

export const importSubmissionsFromExcel = async ({
  loaiDonId,
  buffer,
  actorUserId,
}) => {
  const loaiDon = await LoaiDon.findById(loaiDonId);
  if (!loaiDon || loaiDon.isActive === false) {
    throw new NotFoundError('Không tìm thấy mẫu đơn đang hoạt động');
  }
  if (!loaiDon.templateFile) {
    throw new ValidationError('Mẫu đơn chưa có file Word gốc');
  }

  const importableFields = getImportableFields(loaiDon);
  if (!importableFields.length) {
    throw new ValidationError('Mẫu đơn không có trường text để import');
  }

  const { rows, detectedHeaders, headerRow } = parseExcelRows(buffer);
  const columnMapping = buildColumnMapping(detectedHeaders, importableFields);

  if (!columnMapping.matchedPlaceholders.length && !columnMapping.hasIdentityColumn) {
    throw new ValidationError(
      'Không tìm thấy cột Excel nào khớp trường mẫu đơn. Kiểm tra tên cột (ví dụ MSSV, HO_TEN) hoặc tải mẫu Excel để tham khảo.',
    );
  }

  if (!columnMapping.hasIdentityColumn && !columnMapping.mapping.MSSV && !columnMapping.mapping.EMAIL) {
    throw new ValidationError(
      'File Excel cần ít nhất một cột định danh sinh viên (MSSV hoặc Email) để gán hồ sơ.',
    );
  }

  const dataRows = rows.filter((row) => {
    const map = toRowMap(row);
    return !isEmptyRow(map) && !isGuideRow(map);
  });

  if (!dataRows.length) {
    throw new ValidationError('File Excel không có dòng dữ liệu hợp lệ');
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(
      `Mỗi lần import tối đa ${MAX_IMPORT_ROWS} dòng. File hiện có ${dataRows.length} dòng.`,
    );
  }

  const fieldDefaults = ensureMssvColumn(importableFields);
  const preparedRows = [];
  const errors = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const excelRowNumber = (headerRow || 0) + 2 + i;
    const fields = mapRowToFields(dataRows[i], columnMapping);
    for (const item of fieldDefaults) {
      if (fields[item.placeHolder] === undefined) {
        fields[item.placeHolder] = '';
      }
    }

    if (!fields.MSSV && !fields.EMAIL) {
      errors.push({
        row: excelRowNumber,
        code: 'MISSING_MSSV',
        message: 'Dòng này thiếu MSSV (hoặc Email) để gán hồ sơ cho sinh viên',
      });
      continue;
    }

    preparedRows.push({ excelRowNumber, fields });
  }

  // 1) Một lần tải mẫu + một lần query SV + resolve workflow
  const [preparedTemplate, studentMaps, cachedWorkflow] = await Promise.all([
    prepareTemplateBuffer(loaiDon.templateFile),
    loadStudentsForRows(preparedRows.map((r) => r.fields)),
    workflowService.resolveWorkflowForLoaiDon(loaiDon._id).catch(() => null),
  ]);

  const tempDir = path.join(process.cwd(), 'temp', `bulk_import_${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  /** @type {Array<{ excelRowNumber: number, fields: object, student: any, id: string, docxPath: string, renderFields: object }>} */
  const renderedOk = [];

  // 2) Render DOCX song song
  await mapPool(preparedRows, RENDER_CONCURRENCY, async (item) => {
    const student = resolveStudentFromMaps(item.fields, studentMaps);
    if (!student) {
      errors.push({
        row: item.excelRowNumber,
        code: 'GENERATE_FAILED',
        message:
          'Không tìm thấy sinh viên theo MSSV/Email. Kiểm tra cột MSSV đã có trong hệ thống.',
        detail: { mssv: item.fields.MSSV || '', hoTen: item.fields.HO_TEN || '' },
      });
      return;
    }

    const renderFields = { ...item.fields };
    if (!renderFields.HO_TEN && student.fullName) renderFields.HO_TEN = student.fullName;
    if (!renderFields.MSSV && student.studentId) renderFields.MSSV = student.studentId;
    assignSignatureCaptionFields(renderFields, { user: student });

    try {
      const id = `${item.excelRowNumber}_${crypto.randomBytes(4).toString('hex')}`;
      const docxPath = path.join(tempDir, `row_${id}.docx`);
      const normalizedDocx = renderDocxFromPreparedTemplate(preparedTemplate, renderFields);
      await fs.promises.writeFile(docxPath, normalizedDocx);
      renderedOk.push({
        excelRowNumber: item.excelRowNumber,
        fields: item.fields,
        student,
        id,
        docxPath,
        renderFields,
      });
    } catch (err) {
      errors.push({
        row: item.excelRowNumber,
        code: 'GENERATE_FAILED',
        message: err?.message || 'Không tạo được hồ sơ',
        detail: { mssv: item.fields.MSSV || '', hoTen: item.fields.HO_TEN || '' },
      });
    }
  });

  // 3) Đồng bộ org SV (không chờ LibreOffice — PDF chuyển nền sau khi trả kết quả)
  const syncedStudentIds = new Set();
  await mapPool(
    [...new Map(renderedOk.map((r) => [String(r.student._id), r.student])).values()],
    6,
    async (student) => {
      try {
        await ensureStudentUserLinked(student);
        syncedStudentIds.add(String(student._id));
      } catch {
        // startWorkflow sẽ tự sync nếu thiếu
      }
    },
  );

  // 4) Upload DOCX + tạo hồ sơ + start workflow song song
  const created = [];
  const pdfJobs = [];
  let success = 0;

  await mapPool(renderedOk, UPLOAD_CONCURRENCY, async (item) => {
    try {
      const finalBuffer = await fs.promises.readFile(item.docxPath);
      const finalMimeType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const finalExtension = '.docx';

      let duongDanFile;
      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadBufferToCloudinary(finalBuffer, {
          publicId: `bulk-${item.id}`,
          format: 'docx',
        });
        duongDanFile = uploadResult.secure_url;
      } else {
        const keepDir = path.join(process.cwd(), 'uploads', 'generated');
        await fs.promises.mkdir(keepDir, { recursive: true });
        const localPath = path.join(keepDir, `bulk_${item.id}${finalExtension}`);
        await fs.promises.writeFile(localPath, finalBuffer);
        duongDanFile = localPath;
      }

      const originalFileName = `${loaiDon.tenDon || 'don'}${finalExtension}`;
      const newFile = await GeneratedFile.create({
        tenDon: loaiDon.tenDon || 'Đơn yêu cầu',
        tenNguoiGui: item.renderFields.HO_TEN || item.student.fullName || 'Sinh viên',
        duongDanFile,
        trangThai: 'cho_duyet',
        submittedBy: item.student._id,
        loaiDonId: loaiDon._id,
        sourceType: 'generated',
        originalFileName,
        fileMimeType: finalMimeType,
      });

      await workflowService.startWorkflowForGeneratedFile(newFile._id, item.student._id, {
        workflow: cachedWorkflow || undefined,
        generatedFile: newFile,
        loaiDonId: loaiDon._id,
        skipOrgSync: syncedStudentIds.has(String(item.student._id)),
      });

      success += 1;
      created.push({
        generatedFileId: newFile._id,
        studentId: item.student.studentId || '',
        studentName: item.student.fullName || '',
        actorUserId: actorUserId || null,
      });
      pdfJobs.push({
        fileId: newFile._id,
        publicId: `bulk-${item.id}`,
        originalName: originalFileName,
        docxBuffer: finalBuffer,
      });
    } catch (err) {
      errors.push({
        row: item.excelRowNumber,
        code: 'GENERATE_FAILED',
        message: err?.message || 'Không tạo được hồ sơ',
        detail: {
          mssv: item.fields.MSSV || '',
          hoTen: item.fields.HO_TEN || '',
        },
      });
    } finally {
      await cleanupTempFile(item.docxPath);
    }
  });

  scheduleDocxToPdfUpgrade(pdfJobs);

  try {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  } catch {
    // ignore
  }

  return {
    success,
    errors,
    created,
    detectedHeaders,
    headerRow,
    matchedHeaders: columnMapping.mapping,
    matchedPlaceholders: columnMapping.matchedPlaceholders,
    unexpectedHeaders: columnMapping.unmatchedHeaders,
    missingPlaceholders: columnMapping.unmatchedFields,
    expectedPlaceholders: columnMapping.expectedPlaceholders,
    formName: loaiDon.tenDon,
    totalRows: dataRows.length,
  };
};
