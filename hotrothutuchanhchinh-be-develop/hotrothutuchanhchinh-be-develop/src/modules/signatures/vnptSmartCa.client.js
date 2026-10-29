import crypto from 'crypto';
import axios from 'axios';
import config from '../../config/index.js';
import { ValidationError } from '../../shared/errors/AppError.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const nowStamp = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
};

export const isVnptSmartCaConfigured = () => {
  const { clientId, clientSecret, apiBase } = config.smartCa || {};
  return Boolean(clientId && clientSecret && apiBase);
};

/**
 * VNPT cấp sp_password dạng 2 đoạn base64 nối bằng '-':
 *   NzkxYjIxYmM-MGU3Yy00ZjJj  (= base64("791b21bc") + "-" + base64("0e7c-4f2c"))
 * Khi copy chat/Zalo dấu '-' dễ mất → thành 1 chuỗi base64 liền
 *   NzkxYjIxYmMtMGU3Yy00ZjJj (= base64("791b21bc-0e7c-4f2c")) → gateway trả 401.
 */
export const normalizeSpPassword = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  // Đã đúng dạng 2 đoạn
  if (/^[A-Za-z0-9+/]+=*-[A-Za-z0-9+/]+=*$/.test(raw)) return raw;

  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf8');
    const match = decoded.match(/^([0-9a-fA-F]{8})-(.+)$/);
    if (match) {
      const p1 = Buffer.from(match[1], 'utf8').toString('base64').replace(/=+$/, '');
      const p2 = Buffer.from(match[2], 'utf8').toString('base64').replace(/=+$/, '');
      return `${p1}-${p2}`;
    }
  } catch {
    // keep raw
  }
  return raw;
};

const getClient = () => {
  if (!isVnptSmartCaConfigured()) {
    throw new ValidationError(
      'Chưa cấu hình VNPT SmartCA (SMARTCA_CLIENT_ID / SMARTCA_CLIENT_SECRET).',
    );
  }
  return axios.create({
    baseURL: config.smartCa.apiBase.replace(/\/$/, ''),
    timeout: 30000,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    validateStatus: () => true,
  });
};

const spCredentials = () => ({
  sp_id: String(config.smartCa.clientId || '').trim(),
  sp_password: normalizeSpPassword(config.smartCa.clientSecret),
});

const parseGatewayError = (payload, fallback, httpStatus) => {
  const message =
    payload?.message ||
    payload?.error_description ||
    payload?.error ||
    payload?.data?.message ||
    (typeof payload === 'string' ? payload : '') ||
    fallback ||
    'VNPT SmartCA trả lỗi không xác định';
  const code = payload?.status_code ?? payload?.code ?? httpStatus;
  const detail =
    !payload?.message && payload && typeof payload === 'object'
      ? ` ${JSON.stringify(payload).slice(0, 280)}`
      : '';
  const codePart = code != null && code !== '' ? `[${code}] ` : '';
  return `${codePart}${String(message)}${detail}`.trim();
};

const isSmartCaAccepted = (payload) => {
  const code = Number(payload?.status_code);
  if (code === 200) return true;
  const message = String(payload?.message || '').toLowerCase();
  return (
    message.includes('success') ||
    message.includes('sig_wait') ||
    message.includes('wait_for_user') ||
    message.includes('pending')
  );
};

/** VNPT trả mã này khi URL trạng thái chưa đúng giao dịch, không phải khi thiếu chứng thư. */
const isMissingSignTransaction = (payload) =>
  String(payload?.message || '')
    .toLowerCase()
    .includes('sig_tran_not_exist');

const describeSmartCaFailure = (payload, httpStatus) => {
  const code = Number(payload?.status_code ?? payload?.status ?? httpStatus);
  const errors = payload?.errors;
  if (errors?.serial_number) {
    return `[${code || 400}] Thiếu serial_number chứng thư SmartCA. Hệ thống sẽ lấy serial từ get_certificate — kiểm tra CCCD đã kích hoạt chứng thư trên app VNPT SmartCA.`;
  }
  if (isMissingSignTransaction(payload)) {
    return `[${code || 404}] SmartCA chưa khớp mã giao dịch ký. Nếu điện thoại đã hiện yêu cầu, hãy xác nhận trên app rồi bấm Ký số lại.`;
  }
  const hints = {
    400: 'Yêu cầu không hợp lệ (hash/doc_id/tham số).',
    401: 'Sai sp_id/sp_password hoặc CCCD chưa gắn thuê bao SmartCA của partner này.',
    403: 'Chứng thư số không hợp lệ / hết hạn / bị khóa.',
    404: 'Không tìm thấy chứng thư cho CCCD này trên SmartCA.',
    500: 'Lỗi phía VNPT SmartCA — thử lại sau.',
  };
  const hint = hints[code] ? ` ${hints[code]}` : '';
  return `${parseGatewayError(payload, 'Gửi yêu cầu ký SmartCA thất bại', httpStatus)}${hint}`;
};

/**
 * Lấy thông tin chứng thư số của thuê bao (CCCD/MST...).
 */
export const getCertificate = async (userId, serialNumber = '') => {
  const client = getClient();
  const res = await client.post('/v1/credentials/get_certificate', {
    ...spCredentials(),
    user_id: String(userId).trim(),
    serial_number: serialNumber || '',
    transaction_id: `TTHC_CERT_${crypto.randomUUID()}`,
  });

  if (!isSmartCaAccepted(res.data)) {
    throw new ValidationError(describeSmartCaFailure(res.data, res.status));
  }

  return res.data?.data || res.data;
};

/** Lấy serial chứng thư từ payload get_certificate (nhiều dạng response). */
export const pickCertificateSerial = (certData) => {
  if (!certData || typeof certData !== 'object') return '';

  const lists = [
    certData.user_certificates,
    certData.certificates,
    certData.userCertificates,
    certData.data?.user_certificates,
    certData.data?.certificates,
  ].filter((x) => Array.isArray(x) && x.length);

  for (const list of lists) {
    for (const item of list) {
      const serial =
        item?.serial_number ||
        item?.SerialNumber ||
        item?.cert_serial ||
        item?.serialNumber ||
        '';
      if (String(serial).trim()) return String(serial).trim();
    }
  }

  const direct =
    certData.serial_number ||
    certData.SerialNumber ||
    certData.cert_serial ||
    certData.serialNumber ||
    '';
  return String(direct || '').trim();
};

export const pickCertificateSubject = (certData, fallback = '') => {
  if (!certData || typeof certData !== 'object') return fallback;
  const lists = [
    certData.user_certificates,
    certData.certificates,
    certData.userCertificates,
  ].filter((x) => Array.isArray(x) && x.length);
  for (const list of lists) {
    for (const item of list) {
      const subject = item?.subject || item?.cert_subject || item?.SubjectDN || '';
      if (String(subject).trim()) return String(subject).trim();
    }
  }
  return (
    String(certData.subject || certData.cert_subject || certData.SubjectDN || '').trim() ||
    fallback
  );
};

/**
 * Gửi yêu cầu ký hash → chờ user duyệt trên app VNPT SmartCA → lấy signature_value.
 */
export const signHashWithVnptSmartCa = async ({
  userId,
  documentHashHex,
  docId,
  transactionDesc,
  serialNumber,
  pollIntervalMs = 3000,
  pollTimeoutMs = 120000,
}) => {
  const uid = String(userId || '').trim();
  if (!uid) {
    throw new ValidationError('Vui lòng nhập CCCD/MST (user_id) của thuê bao SmartCA');
  }

  const hash = String(documentHashHex || '')
    .trim()
    .toLowerCase()
    .replace(/^0x/, '');
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new ValidationError('Hash tài liệu không hợp lệ (cần SHA-256 hex 64 ký tự)');
  }

  const serial = String(serialNumber || '').trim();
  if (!serial) {
    throw new ValidationError(
      'Thiếu serial_number chứng thư SmartCA. Kiểm tra CCCD đã kích hoạt chứng thư trên app VNPT SmartCA.',
    );
  }

  const transactionId = `TTHC_${crypto.randomUUID()}`;
  const resolvedDocId = String(docId || transactionId).slice(0, 64);
  const client = getClient();

  const signBody = {
    ...spCredentials(),
    user_id: uid,
    transaction_id: transactionId,
    transaction_desc: transactionDesc || `Ky so ho so ${resolvedDocId}`,
    time_stamp: nowStamp(),
    serial_number: serial,
    sign_files: [
      {
        data_to_be_signed: hash,
        doc_id: resolvedDocId,
        file_type: 'pdf',
        sign_type: 'hash',
      },
    ],
  };

  // Mã partner mobile — một số gói tích hợp dùng để route push tới app SmartCA
  if (config.smartCa.mobileCode) {
    signBody.mobile_code = config.smartCa.mobileCode;
  }

  const signRes = await client.post('/v1/signatures/sign', signBody);
  if (!isSmartCaAccepted(signRes.data)) {
    throw new ValidationError(describeSmartCaFailure(signRes.data, signRes.status));
  }

  const waitData =
    signRes.data?.data && typeof signRes.data.data === 'object' && !Array.isArray(signRes.data.data)
      ? signRes.data.data
      : {};
  // tran_code là mã CA. transaction_id có thể là mã phía mình hoặc mã SP.
  // Hỏi lần lượt: mã sai thường trả sig_tran_not_exist, không được dừng cả lượt ký.
  const pollCandidates = [
    waitData.tran_code,
    waitData.tranCode,
    waitData.transaction_code,
    signRes.data?.tran_code,
    waitData.transaction_id,
    signRes.data?.transaction_id,
    transactionId,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i);

  const extractSignatures = (payload) => {
    const data = payload?.data;
    if (Array.isArray(data?.signatures) && data.signatures.length) return data.signatures;
    if (Array.isArray(payload?.signatures) && payload.signatures.length) return payload.signatures;
    if (Array.isArray(data) && data.length && (data[0]?.signature_value || data[0]?.SignatureValue)) {
      return data;
    }
    const single =
      data?.signature_value ||
      data?.SignatureValue ||
      payload?.signature_value ||
      payload?.SignatureValue;
    if (single) {
      return [
        {
          doc_id: data?.doc_id || payload?.doc_id || resolvedDocId,
          signature_value: single,
          timestamp_signature: data?.timestamp_signature || payload?.timestamp_signature || null,
        },
      ];
    }
    return [];
  };

  const isWaitingStatus = (payload) => {
    const message = String(payload?.message || '').toLowerCase();
    return (
      message.includes('wait') ||
      message.includes('pending') ||
      message.includes('sig_wait') ||
      message.includes('processing')
    );
  };

  const deadline = Date.now() + pollTimeoutMs;
  let lastPayload = signRes.data;
  let pollIndex = 0;
  let missesInRound = 0;

  while (Date.now() < deadline) {
    if (missesInRound === 0) await sleep(pollIntervalMs);

    const pollId = pollCandidates[pollIndex % pollCandidates.length];
    pollIndex += 1;

    const statusRes = await client.post(
      `/v1/signatures/sign/${encodeURIComponent(pollId)}/status`,
      {
        ...spCredentials(),
        transaction_id: waitData.transaction_id || transactionId,
      },
    );
    lastPayload = statusRes.data;

    const statusCode = Number(statusRes.data?.status_code);
    const message = String(statusRes.data?.message || '');
    const signatures = extractSignatures(statusRes.data);
    const signed = signatures.find((s) => s?.signature_value || s?.SignatureValue);

    // Đã có chữ ký → hoàn tất
    if (signed && (statusCode === 200 || !Number.isFinite(statusCode) || /success/i.test(message))) {
      return {
        transactionId,
        pollId,
        docId: resolvedDocId,
        signatureValue: signed.signature_value || signed.SignatureValue,
        timestampSignature: signed.timestamp_signature || null,
        certSerial: serial || waitData.serial_number || null,
        raw: statusRes.data,
      };
    }

    // Mã giao dịch chưa đúng: thử mã kế tiếp ngay, không báo thiếu chứng thư.
    if (isMissingSignTransaction(statusRes.data)) {
      missesInRound += 1;
      if (missesInRound < pollCandidates.length) continue;
      missesInRound = 0;
      continue;
    }
    missesInRound = 0;

    // Vẫn chờ user duyệt trên app (KHÔNG continue mọi status 200 — lỗi cũ làm bỏ qua SUCCESS)
    if (isWaitingStatus(statusRes.data) || (statusCode === 200 && !signed)) {
      continue;
    }

    if (Number.isFinite(statusCode) && statusCode !== 200) {
      throw new ValidationError(describeSmartCaFailure(statusRes.data, statusRes.status));
    }
  }

  throw new ValidationError(
    parseGatewayError(
      lastPayload,
      'Hết thời gian chờ duyệt trên app SmartCA. Nếu đã duyệt trên điện thoại, bấm Ký số lại ngay.',
    ),
  );
};
