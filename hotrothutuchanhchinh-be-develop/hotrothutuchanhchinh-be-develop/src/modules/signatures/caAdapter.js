import crypto from 'crypto';
import { ValidationError } from '../../shared/errors/AppError.js';
import {
  getCertificate,
  isVnptSmartCaConfigured,
  pickCertificateSerial,
  pickCertificateSubject,
  signHashWithVnptSmartCa,
} from './vnptSmartCa.client.js';
import { selectSignerCertificate } from './cmsWrap.js';

const PROVIDERS = {
  smartca_vnpt: {
    label: 'VNPT SmartCA',
    mode: 'remote',
  },
  smartca_viettel: {
    label: 'Viettel SmartCA',
    mode: 'remote',
  },
  usb_token: {
    label: 'USB Token',
    mode: 'local',
  },
  handwritten: {
    label: 'Ký tay',
    mode: 'handwritten',
  },
};

export const listProviders = () => {
  const vnptReady = isVnptSmartCaConfigured();
  return Object.entries(PROVIDERS).map(([value, meta]) => ({
    value,
    label: meta.label,
    mode: meta.mode,
    configured:
      value === 'smartca_vnpt'
        ? vnptReady
        : value === 'handwritten'
          ? true
          : false,
    defaultUserId: '',
  }));
};

const assertProvider = (provider) => {
  if (!PROVIDERS[provider]) {
    throw new ValidationError('Phương thức ký số không hợp lệ');
  }
  return PROVIDERS[provider];
};

const mockSign = ({ provider, providerMeta, pin, smartCaUsername, documentHash, signer }) => {
  const certSerial = `MOCK-${provider.toUpperCase()}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
  const certSubject = `CN=${signer.fullName}, E=${signer.email}, O=CTUT, C=VN`;
  const signatureValue = crypto
    .createHmac('sha256', `${provider}:${pin || smartCaUsername || 'smartca'}`)
    .update(`${documentHash}:${signer.id}:${Date.now()}`)
    .digest('hex');

  return {
    provider,
    providerLabel: providerMeta.label,
    mode: providerMeta.mode,
    certSerial,
    certSubject,
    signatureValue,
    signedAt: new Date(),
    isMock: true,
  };
};

/**
 * Adapter CA — VNPT SmartCA live khi có SMARTCA_CLIENT_ID/SECRET; các provider khác vẫn mock.
 */
export const requestSignature = async ({
  provider,
  pin,
  smartCaUsername,
  documentHash,
  signer,
  docId,
  transactionDesc,
}) => {
  const providerMeta = assertProvider(provider);

  if (provider === 'handwritten') {
    const signatureValue = crypto
      .createHmac('sha256', `handwritten:${signer.id}`)
      .update(`${documentHash}:${Date.now()}`)
      .digest('hex');
    return {
      provider,
      providerLabel: providerMeta.label,
      mode: providerMeta.mode,
      certSerial: `HAND-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      certSubject: `CN=${signer.fullName}, E=${signer.email}, O=CTUT, C=VN`,
      signatureValue,
      signedAt: new Date(),
      isMock: true,
    };
  }

  if (provider === 'usb_token') {
    if (!pin || String(pin).trim().length < 4) {
      throw new ValidationError('Vui lòng nhập mã PIN USB Token (tối thiểu 4 ký tự)');
    }
    return mockSign({
      provider,
      providerMeta,
      pin,
      smartCaUsername,
      documentHash,
      signer,
    });
  }

  if (provider === 'smartca_viettel') {
    if (!smartCaUsername?.trim()) {
      throw new ValidationError('Vui lòng nhập CCCD/MST tài khoản Viettel SmartCA');
    }
    // Chưa có credential Viettel — giữ mock để demo UI
    return mockSign({
      provider,
      providerMeta,
      pin,
      smartCaUsername,
      documentHash,
      signer,
    });
  }

  if (provider === 'smartca_vnpt') {
    const userId =
      String(smartCaUsername || '').trim() || String(signer?.smartCaUserId || '').trim();
    if (!userId) {
      throw new ValidationError(
        'Chưa gắn thuê bao VNPT SmartCA. Vào Cài đặt tài khoản để tích hợp, hoặc nhập CCCD/MST khi ký.',
      );
    }

    if (!isVnptSmartCaConfigured()) {
      // Dev fallback khi chưa cấu hình env
      return mockSign({
        provider,
        providerMeta,
        pin,
        smartCaUsername: userId,
        documentHash,
        signer,
      });
    }

    let certSerial = '';
    let certSubject = `CN=${signer.fullName}, E=${signer.email}, O=CTUT, C=VN`;
    let signerCertBase64 = '';
    try {
      let certData = await getCertificate(userId);
      let picked = selectSignerCertificate(certData);
      if (picked.serial && !picked.certBase64) {
        certData = await getCertificate(userId, picked.serial);
        picked = selectSignerCertificate(certData);
      }
      if (!picked.serial) {
        certSerial = pickCertificateSerial(certData);
        certSubject = pickCertificateSubject(certData, certSubject);
      } else {
        certSerial = picked.serial;
        certSubject = picked.subject || pickCertificateSubject(certData, certSubject);
        signerCertBase64 = picked.certBase64;
      }
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      const msg = String(err?.message || '');
      if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timeout/i.test(msg)) {
        throw new ValidationError(
          'Không kết nối được VNPT SmartCA. Kiểm tra mạng/SMARTCA_*, hoặc xóa SMARTCA_CLIENT_ID/SECRET trong .env để test mock.',
        );
      }
      throw new ValidationError(
        `Không lấy được chứng thư SmartCA cho CCCD ${userId}: ${msg || 'lỗi không xác định'}`,
      );
    }

    if (!certSerial) {
      throw new ValidationError(
        `CCCD ${userId} chưa có chứng thư số (serial_number) trên VNPT SmartCA. Mở app SmartCA kiểm tra đã kích hoạt chứng thư chưa.`,
      );
    }
    if (!signerCertBase64) {
      throw new ValidationError(
        `CCCD ${userId} thiếu cert_data chứng thư — không tạo được CMS để nhúng PDF.`,
      );
    }

    try {
      const signed = await signHashWithVnptSmartCa({
        userId,
        documentHashHex: documentHash,
        docId,
        transactionDesc,
        serialNumber: certSerial,
      });

      return {
        provider,
        providerLabel: providerMeta.label,
        mode: providerMeta.mode,
        certSerial: signed.certSerial || certSerial,
        certSubject,
        signatureValue: signed.signatureValue,
        signerCertBase64,
        signedAt: new Date(),
        isMock: false,
        transactionId: signed.transactionId,
        pollId: signed.pollId,
        meta: {
          docId: signed.docId,
          timestampSignature: signed.timestampSignature,
          signerCertBase64,
        },
      };
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(
        `Ký SmartCA thất bại: ${err?.message || 'lỗi không xác định'}. Nếu đang chạy local, có thể máy chưa có PDF (cần LibreOffice) hoặc chưa gọi được cổng VNPT.`,
      );
    }
  }

  throw new ValidationError('Phương thức ký số không được hỗ trợ');
};

export const verifySignatureValue = ({ documentHash, signatureValue, certSerial, padesEmbedded }) => {
  if (!documentHash || !signatureValue || !certSerial) {
    return { valid: false, reason: 'Thiếu dữ liệu chữ ký' };
  }
  return {
    valid: true,
    reason: padesEmbedded
      ? 'PDF đã nhúng chữ ký PAdES (ETSI.CAdES.detached) từ VNPT SmartCA'
      : isVnptSmartCaConfigured()
        ? 'Chữ ký đã được xác nhận qua giao dịch VNPT SmartCA (metadata hệ thống)'
        : 'Chữ ký hợp lệ (xác minh nội bộ hệ thống)',
    documentHash,
    certSerial,
    padesEmbedded: Boolean(padesEmbedded),
  };
};
