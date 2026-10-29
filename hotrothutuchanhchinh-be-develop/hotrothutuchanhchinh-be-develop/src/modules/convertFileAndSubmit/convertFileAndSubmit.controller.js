// [SHARED-BE] API dùng chung admin portal + student FE (hotrothutuchanhchinh-fe)
import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import GeneratedFile from './GeneratedFile.model.js';
import LoaiDon from '../importForms/LoaiDon.model.js';
import User from '../users/user.model.js';
import * as workflowService from '../workflows/workflow.service.js';
import * as studentProgressService from '../workflows/studentProgress.service.js';
import { isCloudinaryConfigured } from '../../config/cloudinary.js';
import {
  findGeneratedFileByReference,
  readStoredFileBuffer,
  uploadPrivateRawFile,
} from '../../shared/storage/privateRawStorage.js';
import { assertCanViewSubmission, loadSubmissionViewer } from '../workflows/submissionAccess.js';
import { userCanViewSubmission } from '../workflows/workflowScope.js';
import { normalizeDocxForPdfExport } from './docxPdfNormalize.js';
import {
  assignSignatureCaptionFields,
  injectSignatureCaptionPlaceholders,
  injectRenderedSignatureCaptions,
  tightenDatePlaceholdersInTemplate,
} from './signatureCaption.js';
import {
  buildContentHash,
  getTemplateBuffer,
  storePreviewPdf,
  takePreviewPdfIfMatch,
} from './previewCache.js';
import { convertDocxToPdfBuffer, convertDocxBufferToPdf, warmLibreOffice } from './pdfConvert.js';
import { ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import { assertNvqsEligibilityOrThrow, resolveNvqsEligibilityKind } from '../../shared/utils/nvqsEligibility.js';
import { getMyStudentProfile } from '../users/studentProfile.service.js';

export { warmLibreOffice };

const respondConvertError = (res, err) => {
  if (res.headersSent) return undefined;
  const status = err?.statusCode && Number.isFinite(err.statusCode) ? err.statusCode : 500;
  return res.status(status).json({
    success: false,
    message: err?.message || 'Lỗi xử lý đơn',
    code: err?.code,
  });
};

/** Mẫu đã ngừng hoạt động vẫn hiện bên sinh viên nhưng không nộp được. */
const assertLoaiDonOpen = (loaiDon) => {
  if (loaiDon?.isActive === false) {
    throw new ForbiddenError('Mẫu đơn này đang ngừng hoạt động. Sinh viên chưa thể nộp hồ sơ.');
  }
};

/** Chặn nộp / xem trước sai loại đơn NVQS theo mốc tốt nghiệp dự kiến */
const enforceNvqsEligibility = async (req, loaiDon) => {
  if (!loaiDon || !resolveNvqsEligibilityKind(loaiDon)) return;
  if (!req.user?.id) {
    throw new ForbiddenError('Vui lòng đăng nhập để nộp đơn tạm hoãn NVQS.');
  }
  const profile = await getMyStudentProfile(req.user.id);
  assertNvqsEligibilityOrThrow(loaiDon, profile);
};


const ALLOWED_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/pdf',
]);

/** Payload ký tay sinh viên gửi kèm generate (JSON string hoặc object) */
const parseStudentSignaturePayload = (body = {}) => {
  if (!body.signature) return null;
  try {
    const raw = typeof body.signature === 'string' ? JSON.parse(body.signature) : body.signature;
    if (!raw || raw.provider !== 'handwritten') return null;
    return {
      provider: 'handwritten',
      stampImageUrl: raw.stampImageUrl || '',
      placement: raw.placement || null,
    };
  } catch {
    return null;
  }
};

const stripStoredPrefix = (fileName = '') => fileName.replace(/^\d+_/, '');

const resolveTemplateUrl = (body = {}) => body.url || body.templateFile;

const resolveLoaiDonFromBody = async (body = {}) => {
  if (body.loaiDonId) {
    return LoaiDon.findById(body.loaiDonId);
  }
  const templateUrl = resolveTemplateUrl(body);
  if (templateUrl) {
    return LoaiDon.findOne({ templateFile: templateUrl });
  }
  return null;
};

const resolveSubmitterUserId = async (req, fields = {}) => {
  if (req.user?.id) return req.user.id;

  const studentId = fields.MSSV || fields.mssv || fields.studentId;
  if (studentId) {
    const normalizedStudentId = String(studentId).trim();
    const user = await User.findOne({
      $or: [
        { studentId: normalizedStudentId },
        { email: normalizedStudentId.toLowerCase() },
      ],
      role: 'student',
    });
    if (user) return user._id;
  }

  const email = fields.submitterEmail || fields.email || fields.EMAIL;
  if (email) {
    const user = await User.findOne({
      email: String(email).trim().toLowerCase(),
      role: 'student',
    });
    if (user) return user._id;
  }

  return null;
};

const getSafeDownloadName = async (fileUrl) => {
  const generated = await GeneratedFile.findOne({ duongDanFile: fileUrl }).select(
    'originalFileName tenDon fileMimeType',
  );
  if (generated) {
    const ext =
      path.extname(generated.originalFileName || '') ||
      (generated.fileMimeType === 'application/pdf' ? '.pdf' : '.docx');
    return generated.originalFileName || `${generated.tenDon || 'tai-lieu'}${ext}`;
  }
  return stripStoredPrefix(path.basename(fileUrl || 'tai-lieu'));
};

const setDownloadHeaders = (res, contentType, fileName, disposition = 'attachment') => {
  const asciiFileName = String(fileName || 'tai-lieu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/"/g, '');
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
  );
};

const isPdfBuffer = (buffer) =>
  Boolean(buffer?.length >= 4 && Buffer.from(buffer.slice(0, 4)).toString() === '%PDF');

const ensurePdfBuffer = async (buffer, sourceUrl = '') => {
  if (isPdfBuffer(buffer)) return { buffer, isPdf: true };
  const lower = String(sourceUrl || '').toLowerCase();
  const looksDocx =
    lower.includes('.docx') ||
    (buffer?.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b);
  if (!looksDocx) return { buffer, isPdf: false };

  let docxBuffer = buffer;
  try {
    docxBuffer = normalizeDocxForPdfExport(buffer);
  } catch (err) {
    console.warn('[view-file] normalize DOCX bỏ qua:', err?.message || err);
  }

  const pdf = await convertDocxBufferToPdf(docxBuffer);
  if (pdf && isPdfBuffer(pdf)) return { buffer: pdf, isPdf: true };
  return { buffer, isPdf: false };
};

async function cleanupTempFile(filePath) {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }
}

/** Gán file upload chữ ký phụ huynh / sinh viên vào fields docxtemplater. */
const assignUploadedSignatureFields = (req, fields) => {
  const uploadedFiles = req.files || {};
  const signatureFields = ['CHU_KY_PH', 'CHU_KY_SV'];

  return signatureFields.flatMap((fieldName) => {
    const file = uploadedFiles[fieldName]?.[0];
    if (!file?.path) return [];
    fields[fieldName] = file.path;
    return [file.path];
  });
};

const buildDocxtemplater = (buffer) => {
  const zip = new PizZip(buffer);
  const imageModule = new ImageModule({
    // Canh giữa ảnh chữ ký trong ô — thẳng hàng với "Người làm đơn" / "Ý kiến của phụ huynh".
    centered: true,
    getImage(tagValue) {
      return fs.readFileSync(tagValue);
    },
    // Chữ ký nhỏ hơn để cột "Người làm đơn" đủ chỗ cho cả dòng ngày tháng năm.
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

/** Chuẩn bị fields + inject caption dưới {%CHU_KY_*} rồi tạo Docxtemplater. */
const prepareDocxtemplater = (templateBuffer, fields, req) => {
  assignSignatureCaptionFields(fields, req);
  let prepared = injectSignatureCaptionPlaceholders(Buffer.from(templateBuffer));
  prepared = tightenDatePlaceholdersInTemplate(prepared);
  return buildDocxtemplater(prepared);
};

const writeNormalizedDocx = async (docxBuffer, docxPath) => {
  const normalized = normalizeDocxForPdfExport(docxBuffer);
  await fs.promises.writeFile(docxPath, normalized);
  return normalized;
};

const stripMetaFields = (body = {}) => {
  const {
    url: _url,
    templateFile: _templateFile,
    loaiDonId: _loaiDonId,
    previewId: _previewId,
    signature: _signature,
    ...fields
  } = body;
  return fields;
};

class ConvertFileAndSubmitController {
  /** [STUDENT-FE] Preview đơn đã điền placeholder trên web */
  previewFile = async (req, res) => {
    let tempImagePaths = [];
    let docxPath = null;
    let pdfPath = null;
    try {
      const templateUrl = resolveTemplateUrl(req.body);
      const fields = stripMetaFields(req.body);
      tempImagePaths = assignUploadedSignatureFields(req, fields);

      if (!templateUrl) {
        await Promise.allSettled(tempImagePaths.map(cleanupTempFile));
        return res.status(400).json({ success: false, message: 'Missing template URL' });
      }

      const loaiDon = await resolveLoaiDonFromBody(req.body);
      assertLoaiDonOpen(loaiDon);
      await enforceNvqsEligibility(req, loaiDon);
      const templateBuffer = await getTemplateBuffer(templateUrl);
      const doc = prepareDocxtemplater(templateBuffer, fields, req);

      doc.render(fields);

      let docxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      docxBuffer = injectRenderedSignatureCaptions(docxBuffer, fields);
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });

      const id = Date.now();
      docxPath = path.join(tempDir, `preview-${id}.docx`);
      pdfPath = path.join(tempDir, `preview-${id}.pdf`);
      const normalizedDocx = await writeNormalizedDocx(docxBuffer, docxPath);

      const finalPdfBuffer = await convertDocxToPdfBuffer(docxPath, tempDir, normalizedDocx);
      if (!finalPdfBuffer) {
        throw new Error(
          'Không thể chuyển DOCX sang PDF. Server cần LibreOffice (soffice) để xem trước đơn.',
        );
      }
      await fs.promises.writeFile(pdfPath, finalPdfBuffer);

      const contentHash = await buildContentHash(fields, {
        loaiDonId: loaiDon?._id || req.body.loaiDonId || '',
        templateUrl,
      });
      const previewId = await storePreviewPdf({
        pdfBuffer: finalPdfBuffer,
        contentHash,
        loaiDonId: loaiDon?._id || req.body.loaiDonId,
        userId: req.user?.id,
        templateUrl,
      });

      await Promise.allSettled([
        ...tempImagePaths.map(cleanupTempFile),
        cleanupTempFile(docxPath),
        cleanupTempFile(pdfPath),
      ]);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
      res.setHeader('X-Preview-Id', previewId);
      res.setHeader('Access-Control-Expose-Headers', 'X-Preview-Id');
      return res.send(finalPdfBuffer);
    } catch (err) {
      await Promise.allSettled([
        ...tempImagePaths.map(cleanupTempFile),
        cleanupTempFile(docxPath),
        cleanupTempFile(pdfPath),
      ]);
      if (!res.headersSent) {
        return respondConvertError(res, err);
      }
      return undefined;
    }
  };

  /** [STUDENT-FE] Sinh PDF, lưu hồ sơ và khởi chạy quy trình theo mẫu đơn */
  generateFile = async (req, res) => {
    let tempImagePaths = [];
    let docxPath = null;
    let pdfPath = null;
    try {
      const templateUrl = resolveTemplateUrl(req.body);
      const previewId = req.body.previewId || '';
      const fields = stripMetaFields(req.body);
      tempImagePaths = assignUploadedSignatureFields(req, fields);

      if (!templateUrl) {
        await Promise.allSettled(tempImagePaths.map(cleanupTempFile));
        return res.status(400).json({ success: false, message: 'Missing template URL' });
      }

      const loaiDon = await resolveLoaiDonFromBody(req.body);
      assertLoaiDonOpen(loaiDon);
      await enforceNvqsEligibility(req, loaiDon);
      const submitterId = await resolveSubmitterUserId(req, fields);
      let returnedFile = null;
      if (submitterId && loaiDon?._id && req.user?.role === 'student') {
        await workflowService.assertNoDuplicateOpenSubmission(submitterId, loaiDon._id);
        returnedFile = await workflowService.findReturnedSubmission(submitterId, loaiDon._id);
      }
      const contentHash = await buildContentHash(fields, {
        loaiDonId: loaiDon?._id || req.body.loaiDonId || '',
        templateUrl,
      });

      const tempDir = path.join(process.cwd(), 'temp');
      await fs.promises.mkdir(tempDir, { recursive: true });
      const id = Date.now();
      docxPath = path.join(tempDir, `${id}.docx`);
      pdfPath = path.join(tempDir, `${id}.pdf`);

      let finalFilePath = docxPath;
      let finalMimeType =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      let finalExtension = '.docx';
      let reusedPreview = false;

      const cachedPdf = await takePreviewPdfIfMatch({
        previewId,
        contentHash,
        loaiDonId: loaiDon?._id || req.body.loaiDonId,
        userId: req.user?.id,
        templateUrl,
      });

      if (cachedPdf) {
        await fs.promises.writeFile(pdfPath, cachedPdf);
        finalFilePath = pdfPath;
        finalMimeType = 'application/pdf';
        finalExtension = '.pdf';
        reusedPreview = true;
        console.log(`[Generate] Reused preview PDF ${previewId}`);
      } else {
        const templateBuffer = await getTemplateBuffer(templateUrl);
        const doc = prepareDocxtemplater(templateBuffer, fields, req);

        doc.render(fields);

        let docxBuffer = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
        docxBuffer = injectRenderedSignatureCaptions(docxBuffer, fields);
        const normalizedDocx = await writeNormalizedDocx(docxBuffer, docxPath);

        const pdfBuffer = await convertDocxToPdfBuffer(docxPath, tempDir, normalizedDocx);
        if (pdfBuffer) {
          await fs.promises.writeFile(pdfPath, pdfBuffer);
          finalFilePath = pdfPath;
          finalMimeType = 'application/pdf';
          finalExtension = '.pdf';
        }
      }

      let duongDanFile = finalFilePath;
      if (isCloudinaryConfigured()) {
        const uploadResult = await uploadPrivateRawFile(finalFilePath, {
          folder: 'generated-files',
          publicId: `generated-${id}`,
          format: finalExtension.replace('.', ''),
        });
        duongDanFile = uploadResult.secure_url;
      }

      const signaturePayload = parseStudentSignaturePayload(req.body);
      let stampMeta = null;
      let recordStudentSignature = null;
      const originalFileUrl = duongDanFile;

      if (signaturePayload) {
        if (!req.user?.id || req.user.role !== 'student') {
          await Promise.allSettled([
            cleanupTempFile(docxPath),
            cleanupTempFile(pdfPath),
            ...tempImagePaths.map(cleanupTempFile),
          ]);
          return res.status(403).json({
            success: false,
            message: 'Cần đăng nhập sinh viên để ký tay trên đơn',
          });
        }
        if (finalMimeType !== 'application/pdf') {
          await Promise.allSettled([
            cleanupTempFile(docxPath),
            cleanupTempFile(pdfPath),
            ...tempImagePaths.map(cleanupTempFile),
          ]);
          return res.status(400).json({
            success: false,
            message: 'Ký tay chỉ áp dụng khi tạo được file PDF',
          });
        }

        const signatureService = await import('../signatures/signature.service.js');
        recordStudentSignature = signatureService.recordStudentHandwrittenSignature;
        stampMeta = await signatureService.stampStudentHandwrittenOnSource({
          sourceFileUrl: duongDanFile,
          user: req.user,
          stampImageUrl: signaturePayload.stampImageUrl,
          placement: signaturePayload.placement,
        });
        duongDanFile = stampMeta.signedFileUrl;
        finalMimeType = 'application/pdf';
        finalExtension = '.pdf';
      }

      const submissionPayload = {
        tenDon: loaiDon?.tenDon || fields.tenDon || '\u0110\u01a1n y\u00eau c\u1ea7u',
        tenNguoiGui: fields.HO_TEN || req.user?.fullName || 'Ng\u01b0\u1eddi n\u1ed9p',
        duongDanFile,
        trangThai: 'cho_duyet',
        submittedBy: submitterId || undefined,
        loaiDonId: loaiDon?._id,
        sourceType: 'generated',
        originalFileName: stampMeta
          ? `${(loaiDon?.tenDon || 'don').replace(/\.[^.]+$/, '')}_hand_signed.pdf`
          : `${loaiDon?.tenDon || 'don'}${finalExtension}`,
        fileMimeType: finalMimeType,
      };

      let newFile;
      let resumed = false;
      if (returnedFile && submitterId) {
        returnedFile.set(submissionPayload);
        await returnedFile.save();
        newFile = returnedFile;
        resumed = true;
      } else {
        newFile = await GeneratedFile.create(submissionPayload);
      }

      let currentStep = null;
      if (submitterId) {
        const instance = resumed
          ? await workflowService.resumeReturnedSubmission(newFile._id, submitterId)
          : await workflowService.startWorkflowForGeneratedFile(newFile._id, submitterId);
        currentStep = await workflowService.describeCurrentApproverStep(instance);
        if (stampMeta && req.user?.id && recordStudentSignature) {
          await recordStudentSignature({
            generatedFileId: newFile._id,
            workflowInstanceId: instance._id,
            signedBy: req.user.id,
            stampMeta,
            originalFileUrl,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
          });
        }
      }

      await Promise.allSettled([
        cleanupTempFile(docxPath),
        cleanupTempFile(pdfPath),
        ...tempImagePaths.map(cleanupTempFile),
      ]);

      return res.status(200).json({
        success: true,
        message: resumed
          ? 'Đã gửi lại hồ sơ. Đơn chuyển tới bước kiểm tra đầu tiên.'
          : reusedPreview
            ? 'Nộp đơn thành công (tái sử dụng bản xem trước)'
            : 'Tạo và lưu file thành công',
        data: {
          ...(typeof newFile.toObject === 'function' ? newFile.toObject() : newFile),
          currentStep,
        },
        reusedPreview,
      });
    } catch (err) {
      await Promise.allSettled([
        ...tempImagePaths.map(cleanupTempFile),
        cleanupTempFile(docxPath),
        cleanupTempFile(pdfPath),
      ]);
      if (!res.headersSent) {
        return respondConvertError(res, err);
      }
      return undefined;
    }
  };

  /** [STUDENT-FE] N?p file Word/PDF ?� ?i?n offline */
  submitFilled = async (req, res, next) => {
    const tempPath = req.file?.path;
    try {
      const { loaiDonId, tenNguoiGui } = req.body;
      if (!loaiDonId) {
        await cleanupTempFile(tempPath);
        return res.status(400).json({ success: false, message: 'Thi?u loaiDonId' });
      }
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui l�ng ch?n file ?� ?i?n' });
      }
      if (req.file.mimetype && !ALLOWED_MIME.has(req.file.mimetype)) {
        await cleanupTempFile(tempPath);
        return res.status(400).json({
          success: false,
          message: 'Ch? ch?p nh?n file .docx ho?c .pdf',
        });
      }

      const loaiDon = await LoaiDon.findById(loaiDonId);
      if (!loaiDon) {
        await cleanupTempFile(tempPath);
        return res.status(404).json({ success: false, message: 'Kh�ng t�m th?y m?u bi?u m?u' });
      }

      assertLoaiDonOpen(loaiDon);
      await enforceNvqsEligibility(req, loaiDon);
      let returnedFile = null;
      if (req.user?.id && req.user.role === 'student') {
        await workflowService.assertNoDuplicateOpenSubmission(req.user.id, loaiDon._id);
        returnedFile = await workflowService.findReturnedSubmission(req.user.id, loaiDon._id);
      }

      const buffer = await fs.promises.readFile(tempPath);
      const originalName = req.file.originalname || 'don-da-dien.docx';
      const saveDir = path.join(import.meta.dirname, '../../generated-files');
      if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

      const storedName = `${Date.now()}_${originalName.replace(/[^\w.\-\s]/gi, '_')}`;
      const filePath = path.join(saveDir, storedName);
      await fs.promises.writeFile(filePath, buffer);

      let duongDanFile = filePath;
      if (isCloudinaryConfigured()) {
        const extension = path.extname(originalName).replace('.', '').toLowerCase() || 'pdf';
        const uploadResult = await uploadPrivateRawFile(filePath, {
          folder: 'generated-files',
          publicId: `submitted-${Date.now()}`,
          format: extension,
        });
        duongDanFile = uploadResult.secure_url;
        await cleanupTempFile(filePath);
      }

      const sender =
        (typeof tenNguoiGui === 'string' && tenNguoiGui.trim()) ||
        req.user?.fullName ||
        'Ng\u01b0\u1eddi n\u1ed9p';

      const submissionPayload = {
        tenDon: loaiDon.tenDon,
        tenNguoiGui: sender,
        duongDanFile,
        trangThai: 'cho_duyet',
        submittedBy: req.user?.id,
        loaiDonId: loaiDon._id,
        sourceType: 'uploaded',
        originalFileName: originalName,
        fileMimeType: req.file.mimetype,
      };

      let file;
      let resumed = false;
      if (returnedFile && req.user?.id) {
        returnedFile.set(submissionPayload);
        await returnedFile.save();
        file = returnedFile;
        resumed = true;
      } else {
        file = await GeneratedFile.create(submissionPayload);
      }

      let currentStep = null;
      if (req.user?.id) {
        const instance = resumed
          ? await workflowService.resumeReturnedSubmission(file._id, req.user.id)
          : await workflowService.startWorkflowForGeneratedFile(file._id, req.user.id);
        currentStep = await workflowService.describeCurrentApproverStep(instance);
      }

      await cleanupTempFile(tempPath);

      return res.status(201).json({
        success: true,
        message: resumed
          ? 'Đã gửi lại hồ sơ. Đơn chuyển tới bước kiểm tra đầu tiên.'
          : 'Nộp đơn thành công',
        data: {
          ...(typeof file.toObject === 'function' ? file.toObject() : file),
          currentStep,
        },
      });
    } catch (error) {
      await cleanupTempFile(tempPath);
      return next(error);
    }
  };

  getAll = async (req, res, next) => {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 10;
      const skip = (page - 1) * limit;
      const role = req.user?.role;

      if (role === 'student' || role === 'admin') {
        const filter = role === 'student' ? { submittedBy: req.user.id } : {};
        const [data, total] = await Promise.all([
          GeneratedFile.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
          GeneratedFile.countDocuments(filter),
        ]);
        const responseData =
          role === 'student' ? await studentProgressService.enrichStudentSubmissions(data) : data;
        return res.json({
          success: true,
          data: responseData,
          pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      }

      const viewer = await loadSubmissionViewer(req.user);
      const all = viewer
        ? await GeneratedFile.find({}).sort({ createdAt: -1 })
        : [];
      const visible = [];
      for (const file of all) {
        if (await userCanViewSubmission(viewer, file)) visible.push(file);
      }
      const data = visible.slice(skip, skip + limit);
      return res.json({
        success: true,
        data,
        pagination: {
          page,
          limit,
          total: visible.length,
          totalPages: Math.ceil(visible.length / limit),
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const file = await GeneratedFile.findById(req.params.id);
      if (!file) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
      }

      await assertCanViewSubmission(file, req.user);

      return res.json({ success: true, data: file });
    } catch (error) {
      return next(error);
    }
  };

  getProgress = async (req, res, next) => {
    try {
      const file = await GeneratedFile.findById(req.params.id);
      if (!file) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ' });
      }

      await assertCanViewSubmission(file, req.user);
      const progress = await studentProgressService.buildSubmissionProgress(req.params.id);

      return res.json({ success: true, data: progress });
    } catch (error) {
      return next(error);
    }
  };

  cancel = async (req, res, next) => {
    try {
      const result = await workflowService.cancelByStudent(req.params.id, req.user, {
        reason: req.body?.reason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      return res.json({
        success: true,
        message: result.message || 'Đã hủy hồ sơ thành công',
        data: {
          _id: result.file?._id,
          trangThai: result.file?.trangThai,
          cancelReason: result.file?.cancelReason,
          cancelledAt: result.file?.cancelledAt,
          workflowStatus: result.instance?.status || 'cancelled',
        },
      });
    } catch (error) {
      return next(error);
    }
  };

  viewFile = async (req, res, next) => {
    try {
      const { url } = req.query;
      if (!url) {
        return res.status(400).json({ success: false, message: 'Missing url' });
      }

      const fetchUrl = String(url);
      const file = await findGeneratedFileByReference(fetchUrl);
      if (!file) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem file hồ sơ này',
        });
      }
      await assertCanViewSubmission(file, req.user);

      const storedPath = file.duongDanFile;
      const downloadName = await getSafeDownloadName(storedPath);
      const buffer = await readStoredFileBuffer(storedPath);

      const converted = await ensurePdfBuffer(buffer, fetchUrl);
      if (!converted.isPdf) {
        return next(
          new ValidationError(
            'Chưa có bản PDF để xem. Hệ thống đang chuyển Word → PDF — thử lại sau vài giây. Nếu vẫn lỗi, kiểm tra LibreOffice trên server.',
          ),
        );
      }
      const contentType = 'application/pdf';
      const fileName = String(downloadName || 'tai-lieu').replace(/\.docx$/i, '.pdf');
      setDownloadHeaders(res, contentType, fileName, 'inline');
      return res.send(converted.buffer);
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof ValidationError) return next(error);
      const msg = String(error?.message || '');
      if (/timeout|ECONNABORTED|ENOTFOUND/i.test(msg)) {
        return next(
          new ValidationError(
            'Không tải được file hồ sơ (mạng/Cloudinary chậm). Thử lại, hoặc kiểm tra LibreOffice nếu đang chạy local.',
          ),
        );
      }
      return next(
        new ValidationError(msg || 'Không mở được file hồ sơ. Thử lại sau.'),
      );
    }
  };
}

export default new ConvertFileAndSubmitController();
