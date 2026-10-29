import crypto from 'crypto';
import Signature from './signature.model.js';
import GeneratedFile from '../convertFileAndSubmit/GeneratedFile.model.js';
import User from '../users/user.model.js';
import * as workflowRepository from '../workflows/workflow.repository.js';
import { getCurrentStepDef } from '../workflows/engines/workflowEngine.js';
import {
  isSubmissionInApproverScope,
  userCanHandleWorkflowStep,
} from '../workflows/workflowScope.js';
import { listProviders, requestSignature, verifySignatureValue } from './caAdapter.js';
import { isVnptSmartCaConfigured } from './vnptSmartCa.client.js';
import { loadSourceBytes, stampAndSaveSignedDocument, officialSignTitleLines } from './pdfStamp.service.js';
import { stampVisualAndEmbedPades } from './padesSign.service.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../shared/errors/AppError.js';
import { writeAuditLog } from '../auditLogs/auditLog.service.js';

const STAFF_SCOPE_SELECT =
  'email fullName role khoaId boMonId lopId giangVienId studentId sinhVienId isActive department signatureImageUrl signatureImagePublicId smartCaUserId';

/** JWT chỉ có id/email/role — tải đủ org để kiểm tra cố vấn lớp khi ký */
const loadStaffUser = async (userLike) => {
  const id = userLike?.id || userLike?._id;
  if (!id) return null;
  const staff = await User.findById(id).select(STAFF_SCOPE_SELECT);
  if (!staff || staff.isActive === false) return null;
  return staff;
};

const resolveFileForScopeCheck = async (instance) => {
  let file = instance.generatedFileId;
  if (!file || typeof file !== 'object' || !file.submittedBy || typeof file.submittedBy !== 'object') {
    const fileId = file?._id || file || instance.generatedFileId;
    file = await GeneratedFile.findById(fileId).populate(
      'submittedBy',
      'fullName email role khoaId boMonId lopId giangVienId studentId sinhVienId',
    );
  }
  return file;
};

export const getProviders = () => listProviders();

const resolveInstance = async (fileOrSubmissionId) => {
  let instance = await workflowRepository.findInstanceByGeneratedFile(fileOrSubmissionId);
  if (!instance) {
    instance = await workflowRepository.findInstanceById(fileOrSubmissionId);
  }
  if (!instance) throw new NotFoundError('Không tìm thấy quy trình cho hồ sơ này');
  return instance;
};

const isDataImage = (value) => /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(String(value || ''));

export const signSubmission = async (fileOrSubmissionId, user, payload = {}) => {
  const { provider, pin, smartCaUsername, comment, stampImageUrl, placement } = payload;

  if (!provider) {
    throw new ValidationError('Vui lòng chọn phương thức ký');
  }

  const isHandwritten = provider === 'handwritten';

  const instance = await resolveInstance(fileOrSubmissionId);
  if (['cancelled', 'completed', 'rejected'].includes(instance.status)) {
    throw new ForbiddenError(
      instance.status === 'cancelled'
        ? 'Hồ sơ đã được sinh viên hủy, không thể ký tiếp'
        : instance.status === 'completed'
          ? 'Hồ sơ đã hoàn tất, không thể ký tiếp'
          : 'Hồ sơ đã bị từ chối, không thể ký tiếp',
    );
  }

  const workflow = instance.workflowId || (await workflowRepository.findWorkflowById(instance.workflowId));
  if (!workflow) throw new NotFoundError('Không tìm thấy cấu hình quy trình');

  const currentStep = getCurrentStepDef(workflow, instance.currentStepOrder);
  if (!currentStep) {
    throw new ValidationError('Không xác định được bước quy trình hiện tại');
  }

  const staff = await loadStaffUser(user);
  if (!staff) {
    throw new ForbiddenError('Không xác định được tài khoản xử lý');
  }

  const file = await resolveFileForScopeCheck(instance);
  if (!file) throw new NotFoundError('Không tìm thấy hồ sơ cần ký');

  if (file.trangThai === 'da_huy') {
    throw new ForbiddenError('Hồ sơ đã được sinh viên hủy, không thể ký tiếp');
  }
  if (file.trangThai === 'da_duyet') {
    throw new ForbiddenError('Hồ sơ đã hoàn tất, không thể ký tiếp');
  }
  if (!(await userCanHandleWorkflowStep(staff, currentStep, file))) {
    throw new ForbiddenError('Bạn không có quyền ký bước này trong quy trình');
  }

  if (!(await isSubmissionInApproverScope(staff, file, currentStep))) {
    throw new ForbiddenError('Hồ sơ này không thuộc phạm vi khoa/bộ môn/đơn vị của bạn');
  }

  const signer = staff;
  const effectiveSmartCaUsername =
    String(smartCaUsername || '').trim() || String(signer.smartCaUserId || '').trim();

  if (provider === 'smartca_vnpt' && !effectiveSmartCaUsername) {
    throw new ValidationError(
      'Chưa tích hợp VNPT SmartCA. Vào Cài đặt tài khoản để gắn CCCD/MST thuê bao, rồi thử ký lại.',
    );
  }

  let effectiveStamp = '';
  if (isHandwritten) {
    if (stampImageUrl && (isDataImage(stampImageUrl) || /^https?:\/\//i.test(stampImageUrl))) {
      effectiveStamp = stampImageUrl;
    } else if (signer.signatureImageUrl) {
      effectiveStamp = signer.signatureImageUrl;
    }
    if (!effectiveStamp) {
      throw new ValidationError(
        'Vui lòng vẽ chữ ký tay hoặc dùng ảnh chữ ký đã lưu trong Tài khoản.',
      );
    }
  } else {
    effectiveStamp = stampImageUrl || signer.signatureImageUrl || '';
    if (!effectiveStamp) {
      throw new ValidationError(
        'Bạn chưa có ảnh chữ ký. Vào Tài khoản & chữ ký số để tải ảnh chữ ký trước khi ký duyệt.',
      );
    }
  }

  const signedAt = new Date();
  const titleLines = officialSignTitleLines(signer.role, currentStep.stepName);

  // VNPT SmartCA live: đóng ảnh → hash ByteRange → ký CMS → nhúng PAdES vào PDF
  const usePades =
    !isHandwritten && provider === 'smartca_vnpt' && isVnptSmartCaConfigured();

  let caResult;
  let stamped;
  let padesMeta = { padesEmbedded: false, signatureFormat: null };

  if (usePades) {
    let capturedCa = null;
    stamped = await stampVisualAndEmbedPades(
      {
        sourceFileUrl: file.duongDanFile,
        stampImageUrl: effectiveStamp,
        signerName: signer.fullName,
        providerLabel: 'VNPT SmartCA',
        signatureKind: 'digital',
        placement,
        signedAt,
        titleLines,
        boxTitle: titleLines[0] || '',
        contactInfo: signer.email || '',
        location: 'CTUT',
        reason: `Phe duyet ${file.tenDon || file._id}`,
      },
      async (hashHex) => {
        capturedCa = await requestSignature({
          provider,
          pin,
          smartCaUsername: effectiveSmartCaUsername,
          documentHash: hashHex,
          docId: String(file._id).slice(-12),
          transactionDesc: `Ky so ${file.tenDon || file._id}`,
          signer: {
            id: String(signer._id),
            fullName: signer.fullName,
            email: signer.email,
            smartCaUserId: signer.smartCaUserId || '',
          },
        });
        return {
          signatureValue: capturedCa.signatureValue,
          signerCertBase64: capturedCa.signerCertBase64,
          meta: {
            transactionId: capturedCa.transactionId,
            pollId: capturedCa.pollId,
            certSerial: capturedCa.certSerial,
            signerCertBase64: capturedCa.signerCertBase64,
            ...(capturedCa.meta || {}),
          },
        };
      },
    );
    caResult = capturedCa;
    if (!caResult) {
      throw new ValidationError('Không nhận được kết quả ký từ VNPT SmartCA');
    }
    padesMeta = {
      padesEmbedded: true,
      signatureFormat: stamped.signatureFormat || 'ETSI.CAdES.detached',
    };
  } else {
    // Ký tay / mock / USB / Viettel: đóng ảnh + lưu metadata (chưa nhúng CMS)
    let sourceBytesHash;
    try {
      const pdfBytes = await loadSourceBytes(file.duongDanFile);
      sourceBytesHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
    } catch {
      sourceBytesHash = crypto
        .createHash('sha256')
        .update(String(file.duongDanFile))
        .digest('hex');
    }

    caResult = await requestSignature({
      provider,
      pin,
      smartCaUsername: effectiveSmartCaUsername,
      documentHash: sourceBytesHash,
      docId: String(file._id).slice(-12),
      transactionDesc: `Ky so ${file.tenDon || file._id}`,
      signer: {
        id: String(signer._id),
        fullName: signer.fullName,
        email: signer.email,
        smartCaUserId: signer.smartCaUserId || '',
      },
    });

    stamped = await stampAndSaveSignedDocument({
      sourceFileUrl: file.duongDanFile,
      stampImageUrl: effectiveStamp,
      signerName: signer.fullName,
      providerLabel: caResult.providerLabel,
      certSerial: caResult.certSerial,
      signedAt: caResult.signedAt || signedAt,
      signatureKind: isHandwritten ? 'handwritten' : 'digital',
      placement,
      titleLines,
      boxTitle: isHandwritten ? '' : titleLines[0] || '',
    });
  }

  const signature = await Signature.create({
    generatedFileId: file._id,
    workflowInstanceId: instance._id,
    stepOrder: instance.currentStepOrder,
    signedBy: signer._id,
    provider,
    status: 'signed',
    certSerial: caResult.certSerial,
    certSubject: caResult.certSubject,
    documentHash: stamped.documentHash,
    signatureValue: caResult.signatureValue,
    signedFileUrl: stamped.signedFileUrl,
    stampImageUrl: isDataImage(effectiveStamp) ? '' : effectiveStamp,
    comment: comment || '',
    signedAt: caResult.signedAt,
    meta: {
      providerLabel: caResult.providerLabel,
      mode: caResult.mode,
      isMock: caResult.isMock,
      originalFileUrl: file.duongDanFile,
      signatureKind: isHandwritten ? 'handwritten' : 'digital',
      transactionId: caResult.transactionId || null,
      pollId: caResult.pollId || null,
      padesEmbedded: padesMeta.padesEmbedded,
      signatureFormat: padesMeta.signatureFormat,
      ...(caResult.meta || {}),
    },
  });

  file.duongDanFile = stamped.signedFileUrl;
  file.fileMimeType = 'application/pdf';
  file.originalFileName = file.originalFileName
    ? file.originalFileName.replace(/\.[^.]+$/, '') + (isHandwritten ? '_hand_signed.pdf' : '_signed.pdf')
    : `${isHandwritten ? 'hand_signed' : 'signed'}_${file._id}.pdf`;
  await file.save();

  if (!payload.skipAudit) {
    const audit = payload.auditContext || {};
    await writeAuditLog({
      userId: signer._id,
      action: isHandwritten ? 'signature.hand_signed' : 'signature.signed',
      entityType: 'GeneratedFile',
      entityId: file._id,
      metadata: {
        stepOrder: instance.currentStepOrder,
        provider,
        signatureId: signature._id,
        isMock: Boolean(caResult.isMock),
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    });
  }

  return {
    signature,
    signedFileUrl: stamped.signedFileUrl,
    documentHash: stamped.documentHash,
    provider: caResult.provider,
    providerLabel: caResult.providerLabel,
    certSerial: caResult.certSerial,
    isMock: caResult.isMock,
    padesEmbedded: padesMeta.padesEmbedded,
  };
};

export const verifySignature = async (signatureId) => {
  const signature = await Signature.findById(signatureId);
  if (!signature) throw new NotFoundError('Không tìm thấy chữ ký');

  const result = verifySignatureValue({
    documentHash: signature.documentHash,
    signatureValue: signature.signatureValue,
    certSerial: signature.certSerial,
    padesEmbedded: Boolean(signature.meta?.padesEmbedded),
  });

  if (result.valid && signature.status !== 'verified') {
    signature.status = 'verified';
    await signature.save();
  }

  return {
    signatureId: signature._id,
    ...result,
    provider: signature.provider,
    signedAt: signature.signedAt,
    signedFileUrl: signature.signedFileUrl,
  };
};

export const listSignaturesForFile = async (generatedFileId) =>
  Signature.find({ generatedFileId }).sort({ signedAt: -1 }).lean();

const resolveStudentStampImage = (stampImageUrl, signer) => {
  if (stampImageUrl && (isDataImage(stampImageUrl) || /^https?:\/\//i.test(stampImageUrl))) {
    return stampImageUrl;
  }
  if (signer.signatureImageUrl) return signer.signatureImageUrl;
  return '';
};

/** Sinh viên ký tay lên file PDF (trước khi nộp đơn) — không cần quyền bước workflow */
export const stampStudentHandwrittenOnSource = async ({
  sourceFileUrl,
  user,
  stampImageUrl,
  placement,
}) => {
  if (!user?.id) {
    throw new ValidationError('Cần đăng nhập để ký tay trên đơn');
  }

  const signer = await User.findById(user.id).select(
    'fullName email role signatureImageUrl signatureImagePublicId smartCaUserId',
  );
  if (!signer) throw new NotFoundError('Không tìm thấy người ký');
  if (signer.role !== 'student') {
    throw new ForbiddenError('Chỉ sinh viên mới được ký tay trên đơn nộp');
  }

  const effectiveStamp = resolveStudentStampImage(stampImageUrl, signer);
  if (!effectiveStamp) {
    throw new ValidationError('Vui lòng vẽ chữ ký tay hoặc dùng ảnh chữ ký đã lưu');
  }

  const sourceBytesHash = crypto
    .createHash('sha256')
    .update(String(sourceFileUrl))
    .digest('hex');

  const caResult = await requestSignature({
    provider: 'handwritten',
    documentHash: sourceBytesHash,
    signer: { id: String(signer._id), fullName: signer.fullName, email: signer.email },
  });

  const stamped = await stampAndSaveSignedDocument({
    sourceFileUrl,
    stampImageUrl: effectiveStamp,
    signerName: signer.fullName,
    providerLabel: caResult.providerLabel,
    certSerial: caResult.certSerial,
    signedAt: caResult.signedAt,
    signatureKind: 'handwritten',
    imageOnly: false,
    placement,
    boxTitle: 'Chữ ký sinh viên',
  });

  return {
    signedFileUrl: stamped.signedFileUrl,
    documentHash: stamped.documentHash,
    effectiveStamp,
    caResult,
    signer,
  };
};

export const recordStudentHandwrittenSignature = async ({
  generatedFileId,
  workflowInstanceId,
  signedBy,
  stampMeta,
  originalFileUrl,
  ipAddress,
  userAgent,
}) => {
  const signature = await Signature.create({
    generatedFileId,
    workflowInstanceId,
    stepOrder: 0,
    signedBy,
    provider: 'handwritten',
    status: 'signed',
    certSerial: stampMeta.caResult.certSerial,
    certSubject: stampMeta.caResult.certSubject,
    documentHash: stampMeta.documentHash,
    signatureValue: stampMeta.caResult.signatureValue,
    signedFileUrl: stampMeta.signedFileUrl,
    stampImageUrl: isDataImage(stampMeta.effectiveStamp) ? '' : stampMeta.effectiveStamp,
    comment: 'Sinh viên ký tay khi nộp đơn',
    signedAt: stampMeta.caResult.signedAt,
    meta: {
      providerLabel: stampMeta.caResult.providerLabel,
      mode: stampMeta.caResult.mode,
      isMock: stampMeta.caResult.isMock,
      originalFileUrl,
      signatureKind: 'handwritten',
      signedByRole: 'student',
    },
  });

  await writeAuditLog({
    userId: signedBy,
    action: 'signature.student_hand_signed',
    entityType: 'GeneratedFile',
    entityId: generatedFileId,
    metadata: {
      signatureId: signature._id,
      isMock: Boolean(stampMeta.caResult?.isMock),
    },
    ipAddress,
    userAgent,
  });

  return signature;
};
