import * as asn1js from 'asn1js';
import {
  Certificate,
  ContentInfo,
  SignedData,
  SignerInfo,
  IssuerAndSerialNumber,
  AlgorithmIdentifier,
  EncapsulatedContentInfo,
} from 'pkijs';
import { ValidationError } from '../../shared/errors/AppError.js';

const toArrayBuffer = (buf) => {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/**
 * VNPT SmartCA (sign_type=hash) thường trả signature_value là RSA thô (256 byte),
 * không phải CMS ContentInfo. PDF/NEAC cần PKCS#7 SignedData (ASN.1 bắt đầu bằng 0x30).
 */
export const isAsn1ContentInfo = (buf) => Buffer.isBuffer(buf) && buf.length > 2 && buf[0] === 0x30;

const CERT_BODY_KEYS = [
  'cert_data',
  'certificate',
  'certData',
  'cert',
  'cert_raw',
  'certRaw',
  'cert_content',
  'certificate_data',
];

const readCertString = (value, depth = 0) => {
  if (!value || depth > 2) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value !== 'object') return '';
  for (const key of CERT_BODY_KEYS) {
    const nested = readCertString(value[key], depth + 1);
    if (nested) return nested;
  }
  return '';
};

const collectCertificateItems = (certData) => {
  if (!certData || typeof certData !== 'object') return [];
  const roots = [certData];
  if (certData.data && typeof certData.data === 'object') roots.push(certData.data);
  const items = [];
  for (const root of roots) {
    for (const key of ['user_certificates', 'certificates', 'userCertificates', 'certs']) {
      if (Array.isArray(root[key])) items.push(...root[key]);
    }
  }
  if (!items.length) items.push(certData);
  return items;
};

const isActiveCertificate = (item) => {
  const status = String(item?.cert_status || item?.cert_status_code || item?.status || '').toLowerCase();
  if (!status) return true;
  if (/hết hạn|expired|revok|thu hồi|khóa/.test(status)) return false;
  return true;
};

/** Chọn chứng thư có cả serial và nội dung X.509 để nhúng PDF. */
export const selectSignerCertificate = (certData) => {
  const items = collectCertificateItems(certData).filter((item) => item && typeof item === 'object');
  const ranked = [...items].sort((a, b) => Number(isActiveCertificate(b)) - Number(isActiveCertificate(a)));
  let fallbackSerial = '';
  let fallbackSubject = '';
  for (const item of ranked) {
    const serial = String(
      item.serial_number || item.SerialNumber || item.cert_serial || item.serialNumber || '',
    ).trim();
    const subject = String(item.subject || item.cert_subject || item.SubjectDN || '').trim();
    if (serial && !fallbackSerial) {
      fallbackSerial = serial;
      fallbackSubject = subject;
    }
    const certBase64 = readCertString(item);
    if (!certBase64) continue;
    return { serial: serial || fallbackSerial, certBase64, subject: subject || fallbackSubject };
  }
  return { serial: fallbackSerial, certBase64: '', subject: fallbackSubject };
};

export const pickSignerCertBase64 = (certData) => selectSignerCertificate(certData).certBase64;

/**
 * Bọc chữ ký RSA thô + chứng thư X.509 thành CMS/PKCS#7 detached SignedData.
 */
export const wrapRawSignatureAsPkcs7 = ({ certDerBase64, rawSignature }) => {
  const certB64 = String(certDerBase64 || '')
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  if (!certB64) {
    throw new ValidationError('Thiếu chứng thư SmartCA để tạo CMS/PKCS#7');
  }

  const raw = Buffer.isBuffer(rawSignature) ? rawSignature : Buffer.from(rawSignature || '');
  if (raw.length < 32) {
    throw new ValidationError('Chữ ký SmartCA thô không hợp lệ (quá ngắn)');
  }

  let certificate;
  try {
    const certBer = toArrayBuffer(Buffer.from(certB64, 'base64'));
    certificate = Certificate.fromBER(certBer);
  } catch (err) {
    throw new ValidationError(`Không đọc được chứng thư SmartCA (X.509): ${err?.message || err}`);
  }

  const signedData = new SignedData({
    version: 1,
    encapContentInfo: new EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.7.1', // id-data (detached: không kèm eContent)
    }),
    digestAlgorithms: [
      new AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }), // sha-256
    ],
    certificates: [certificate],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({
          issuer: certificate.issuer,
          serialNumber: certificate.serialNumber,
        }),
        digestAlgorithm: new AlgorithmIdentifier({
          algorithmId: '2.16.840.1.101.3.4.2.1',
        }),
        signatureAlgorithm: new AlgorithmIdentifier({
          algorithmId: '1.2.840.113549.1.1.1', // rsaEncryption
          algorithmParams: new asn1js.Null(),
        }),
        signature: new asn1js.OctetString({ valueHex: toArrayBuffer(raw) }),
      }),
    ],
  });

  const contentInfo = new ContentInfo({
    contentType: '1.2.840.113549.1.7.2', // id-signedData
    content: signedData.toSchema(true),
  });

  const ber = contentInfo.toSchema().toBER(false);
  return Buffer.from(ber);
};

/**
 * Giải mã signature_value VNPT → buffer CMS hợp lệ để nhúng PDF.
 * Nếu đã là CMS thì giữ nguyên; nếu là RSA thô thì bọc PKCS#7 bằng chứng thư.
 */
export const toPdfEmbeddableCms = ({ signatureValue, signerCertBase64 }) => {
  const compact = String(signatureValue || '').replace(/\s+/g, '');
  if (!compact) {
    throw new ValidationError('VNPT SmartCA không trả về signature_value');
  }

  let decoded;
  if (/^[0-9a-fA-F]+$/.test(compact) && compact.length % 2 === 0 && compact.length >= 64) {
    decoded = Buffer.from(compact, 'hex');
  } else {
    decoded = Buffer.from(compact, 'base64');
  }

  if (decoded.length < 32) {
    throw new ValidationError('signature_value từ SmartCA không hợp lệ (quá ngắn)');
  }

  if (isAsn1ContentInfo(decoded)) {
    return decoded;
  }

  // Raw RSA (vd. 256 byte) — bọc CMS
  return wrapRawSignatureAsPkcs7({
    certDerBase64: signerCertBase64,
    rawSignature: decoded,
  });
};
