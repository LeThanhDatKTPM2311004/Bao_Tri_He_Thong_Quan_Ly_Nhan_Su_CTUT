import crypto from 'crypto';
import { SignPdf, Signer } from '@signpdf/signpdf';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ADOBE_PKCS7_DETACHED } from '@signpdf/utils';
import { ValidationError } from '../../shared/errors/AppError.js';
import { prepareStampedPdfDocument, uploadSignedPdf } from './pdfStamp.service.js';
import { toPdfEmbeddableCms } from './cmsWrap.js';

/** Chỗ trống hex Contents (byte CMS). 64KB đủ cho CMS + chuỗi chứng thư. */
const CMS_PLACEHOLDER_BYTES = 65536;

/** @deprecated dùng toPdfEmbeddableCms — giữ export để test cũ không gãy. */
export const decodeCmsSignature = (value, signerCertBase64 = '') =>
  toPdfEmbeddableCms({ signatureValue: value, signerCertBase64 });

const resolveWidgetRect = (pdfDoc, placement) => {
  const pages = pdfDoc.getPages();
  if (!pages.length) return { page: null, widgetRect: undefined };

  if (!placement) {
    return { page: pages[pages.length - 1], widgetRect: undefined };
  }

  const pageIndex = Math.min(Math.max((placement.page || 1) - 1, 0), pages.length - 1);
  const page = pages[pageIndex];
  const { width: pw, height: ph } = page.getSize();
  const boxW = placement.widthRatio * pw;
  const boxH = placement.heightRatio * ph;
  const boxLeft = placement.xRatio * pw;
  const boxTop = placement.yRatio * ph;
  const boxBottom = ph - boxTop - boxH;

  return {
    page,
    widgetRect: [boxLeft, boxBottom, boxLeft + boxW, boxBottom + boxH],
  };
};

/**
 * Đóng ảnh chữ ký → thêm placeholder PAdES → gửi hash ByteRange cho CA → nhúng CMS vào PDF.
 *
 * @param {object} stampOpts — tham số giống prepareStampedPdfDocument (+ reason/contactInfo/location)
 * @param {(hashHex: string) => Promise<{ signatureValue: string, meta?: object, signerCertBase64?: string }>} signHash
 */
export const stampVisualAndEmbedPades = async (stampOpts, signHash) => {
  const { pdfDoc, sourceDocumentHash, placement } = await prepareStampedPdfDocument(stampOpts);
  const { page, widgetRect } = resolveWidgetRect(pdfDoc, placement);

  const signerName = stampOpts.signerName || 'Signer';
  const reason = stampOpts.reason || 'Phe duyet ho so thu tuc hanh chinh';

  pdflibAddPlaceholder({
    pdfDoc,
    pdfPage: page || undefined,
    reason,
    contactInfo: stampOpts.contactInfo || '',
    name: signerName,
    location: stampOpts.location || 'CTUT',
    signingTime: stampOpts.signedAt || new Date(),
    signatureLength: CMS_PLACEHOLDER_BYTES,
    // adbe.pkcs7.detached phù hợp CMS bọc RSA thô từ SmartCA (không CAdES attrs).
    subFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
    widgetRect,
    appName: 'PM_TTHC2',
  });

  const readyPdf = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));

  let caMeta = {};
  let signatureValueRaw = '';

  class RemoteCmsSigner extends Signer {
    async sign(pdfBuffer) {
      const hashHex = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
      const result = await signHash(hashHex);
      signatureValueRaw = result.signatureValue;
      caMeta = result.meta || {};
      const certB64 =
        result.signerCertBase64 || stampOpts.signerCertBase64 || caMeta.signerCertBase64 || '';
      return toPdfEmbeddableCms({
        signatureValue: result.signatureValue,
        signerCertBase64: certB64,
      });
    }
  }

  const signPdf = new SignPdf();
  let signedPdf;
  try {
    signedPdf = await signPdf.sign(readyPdf, new RemoteCmsSigner());
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes('exceeds placeholder length')) {
      throw new ValidationError(
        'Chữ ký CMS từ SmartCA vượt kích thước dự phòng trên PDF. Liên hệ kỹ thuật để tăng signatureLength.',
      );
    }
    throw err;
  }

  const fileName = `pades_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.pdf`;
  const signedFileUrl = await uploadSignedPdf(signedPdf, fileName);
  const documentHash = crypto.createHash('sha256').update(signedPdf).digest('hex');

  return {
    signedFileUrl,
    documentHash,
    sourceDocumentHash,
    pdfBytes: signedPdf,
    signatureValue: signatureValueRaw,
    padesEmbedded: true,
    signatureFormat: 'adbe.pkcs7.detached',
    caMeta,
  };
};
