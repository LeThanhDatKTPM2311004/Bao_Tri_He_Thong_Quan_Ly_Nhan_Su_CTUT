import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js';
import config from '../../config/index.js';
import { ValidationError } from '../errors/AppError.js';
import GeneratedFile from '../../modules/convertFileAndSubmit/GeneratedFile.model.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(moduleDir, '../..');

/** Hồ sơ nộp / PDF đã ký — không phát hành URL công khai. */
export const PRIVATE_RAW_TYPE = 'authenticated';

const DOSSIER_FOLDERS = ['generated-files/', 'pm_tthc/signatures'];

const cloudinaryUrlPattern =
  /res\.cloudinary\.com\/[^/]+\/(?<resource>raw|image|video)\/(?<delivery>upload|authenticated|private)\/(?<rest>.+)$/i;

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const allowedLocalRoots = () => {
  const uploadDir = path.resolve(process.cwd(), config.upload?.dir || './uploads');
  return [
    path.resolve(srcDir, 'generated-files'),
    path.resolve(process.cwd(), 'uploads'),
    path.resolve(process.cwd(), 'temp'),
    path.resolve(process.cwd(), 'src/generated-files'),
    uploadDir,
    path.resolve(uploadDir, 'signatures'),
    path.resolve(uploadDir, 'generated'),
  ];
};

const isInsideRoot = (filePath, root) =>
  filePath === root || filePath.startsWith(`${root}${path.sep}`);

export const parseCloudinaryDeliveryUrl = (fileUrl) => {
  const raw = String(fileUrl || '').split('?')[0];
  const match = raw.match(cloudinaryUrlPattern);
  if (!match?.groups) return null;

  const segments = match.groups.rest.split('/').filter(Boolean);
  while (segments.length && (segments[0].startsWith('s--') || /^v\d+$/.test(segments[0]))) {
    segments.shift();
  }

  const publicIdWithExt = decodeURIComponent(segments.join('/'));
  if (!publicIdWithExt) return null;

  const format = publicIdWithExt.includes('.') ? publicIdWithExt.split('.').pop() : '';
  const publicId =
    match.groups.resource === 'raw'
      ? publicIdWithExt
      : publicIdWithExt.replace(/\.[^/.]+$/, '');

  return {
    resourceType: match.groups.resource,
    delivery: match.groups.delivery,
    publicId,
    format,
  };
};

const isDossierPublicId = (publicId) =>
  DOSSIER_FOLDERS.some((folder) => String(publicId || '').includes(folder));

export const uploadPrivateRawFile = (localPath, { folder, publicId, format }) =>
  cloudinary.uploader.upload(localPath, {
    resource_type: 'raw',
    type: PRIVATE_RAW_TYPE,
    folder,
    public_id: publicId,
    format,
  });

export const uploadPrivateRawBuffer = (buffer, { folder, publicId, format }) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        type: PRIVATE_RAW_TYPE,
        folder,
        public_id: publicId,
        format,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      },
    );
    stream.end(buffer);
  });

const signedDownloadUrl = (parsed) =>
  cloudinary.utils.private_download_url(parsed.publicId, parsed.format, {
    resource_type: parsed.resourceType,
    type: parsed.delivery,
    expires_at: Math.floor(Date.now() / 1000) + 120,
  });

const downloadUrlToBuffer = async (url) => {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 20000,
    maxContentLength: 30 * 1024 * 1024,
    validateStatus: (status) => status >= 200 && status < 400,
  });
  return Buffer.from(response.data);
};

/** Đổi file hồ sơ đang public sang authenticated và cập nhật đường dẫn đã lưu. */
const promotePublicDossier = async (fileUrl, parsed) => {
  if (!parsed || parsed.delivery !== 'upload' || parsed.resourceType !== 'raw') return fileUrl;
  if (!isDossierPublicId(parsed.publicId) || !isCloudinaryConfigured()) return fileUrl;

  try {
    const renamed = await cloudinary.uploader.rename(parsed.publicId, parsed.publicId, {
      resource_type: 'raw',
      type: 'upload',
      to_type: PRIVATE_RAW_TYPE,
      overwrite: true,
    });
    const nextUrl = renamed?.secure_url;
    if (!nextUrl || nextUrl === fileUrl) return fileUrl;
    await GeneratedFile.updateMany({ duongDanFile: fileUrl }, { $set: { duongDanFile: nextUrl } });
    return nextUrl;
  } catch (error) {
    console.warn('[private-storage] Không chuyển được file sang chế độ riêng tư:', error?.message || error);
    return fileUrl;
  }
};

const readLocalFile = async (storedPath) => {
  const resolved = path.resolve(String(storedPath));
  const allowed = allowedLocalRoots().some((root) => isInsideRoot(resolved, root));
  if (!allowed) {
    throw new ValidationError('Không tìm thấy file hồ sơ trên máy chủ');
  }
  try {
    return await fs.readFile(resolved);
  } catch {
    throw new ValidationError('Không tìm thấy file hồ sơ trên máy chủ');
  }
};

export const readStoredFileBuffer = async (storedPath) => {
  const source = String(storedPath || '');
  if (!source) throw new ValidationError('Không có nguồn file hồ sơ');

  if (!isRemoteUrl(source)) return readLocalFile(source);

  const parsed = parseCloudinaryDeliveryUrl(source);
  if (!parsed || !source.includes('res.cloudinary.com') || !isCloudinaryConfigured()) {
    throw new ValidationError('Không tải được file hồ sơ');
  }

  const deliveryUrl = await promotePublicDossier(source, parsed);
  const deliveryParsed = parseCloudinaryDeliveryUrl(deliveryUrl) || parsed;

  try {
    return await downloadUrlToBuffer(signedDownloadUrl(deliveryParsed));
  } catch (signedError) {
    if (deliveryParsed.delivery !== 'upload') {
      throw new ValidationError(
        `Không tải được file hồ sơ. ${signedError?.message || 'Kiểm tra kho file.'}`,
      );
    }
    try {
      return await downloadUrlToBuffer(deliveryUrl);
    } catch (error) {
      throw new ValidationError(
        `Không tải được file hồ sơ. ${error?.message || 'Kiểm tra kho file.'}`,
      );
    }
  }
};

export const findGeneratedFileByReference = async (fileUrl) => {
  const exact = await GeneratedFile.findOne({ duongDanFile: fileUrl });
  if (exact) return exact;

  const parsed = parseCloudinaryDeliveryUrl(fileUrl);
  if (!parsed?.publicId || !isDossierPublicId(parsed.publicId)) return null;

  const escaped = parsed.publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return GeneratedFile.findOne({ duongDanFile: new RegExp(escaped) });
};
