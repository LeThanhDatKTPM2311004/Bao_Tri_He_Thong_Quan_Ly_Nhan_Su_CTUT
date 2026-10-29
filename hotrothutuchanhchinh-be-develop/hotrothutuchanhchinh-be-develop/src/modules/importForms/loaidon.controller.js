import LoaiDon from './LoaiDon.model.js';
import { parsePagination, buildPaginationMeta } from '../../shared/utils/pagination.js';
import path from 'path';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js';
import fs from 'fs';
import axios from 'axios';
import mammoth from 'mammoth';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { buildChatbotIndex } from '../chatbot/procedureIndexer.js';
import {
  buildExcelTemplateBuffer,
  importSubmissionsFromExcel,
} from './bulkFormImport.service.js';
import { resolveNvqsEligibilityKind } from '../../shared/utils/nvqsEligibility.js';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const hasVietnamese = (s) => /[À-ỹĐđ]/.test(s || '');
const looksMojibake = (s) =>
  /Ä|Æ |Ã.|Â.|â€|â€™|á»|táº|giá»|thá»|Máº|ĐÆ|»|°|¬|ÃĐ|Ã»|Ãº/.test(s || '');

const decodeUploadFileName = (name) => {
  if (!name || typeof name !== 'string') return 'mau-bieu-mau';
  const tryLatin1ToUtf8 = (raw) => {
    try {
      const decoded = Buffer.from(raw, 'latin1').toString('utf8');
      if (decoded.includes('\uFFFD')) return null;
      return decoded;
    } catch {
      return null;
    }
  };
  if (looksMojibake(name) || !hasVietnamese(name)) {
    const once = tryLatin1ToUtf8(name);
    if (once && hasVietnamese(once) && !looksMojibake(once)) return once;
    if (once && looksMojibake(once)) {
      const twice = tryLatin1ToUtf8(once);
      if (twice && hasVietnamese(twice) && !looksMojibake(twice)) return twice;
    }
  }
  return name;
};

const fixTenDonDisplay = (tenDon) => decodeUploadFileName(tenDon);

/** Nhãn tiếng Việt cho placeholder phổ biến (NVQS + đơn thường). */
const PLACEHOLDER_LABELS = {
  HO_TEN: 'Họ và tên sinh viên',
  NGAY_SINH: 'Ngày, tháng, năm sinh',
  CCCD: 'Số CMND/CCCD',
  NOI_CAP_CCCD: 'Nơi cấp CCCD',
  NOI_CAP: 'Nơi cấp CCCD',
  KHOA: 'Khoa',
  NGANH: 'Ngành đào tạo',
  MSSV: 'Mã số sinh viên',
  KHOA_HOC: 'Khóa học',
  LOP: 'Lớp',
  LOAI_HINH_DAO_TAO: 'Loại hình đào tạo',
  THOI_GIAN_DAO_TAO: 'Thời gian đào tạo',
  TRINH_DO: 'Trình độ đào tạo',
  NAM_HOC: 'Năm học',
  THOI_GIAN_NHAP_HOC: 'Thời gian nhập học',
  THOI_GIAN_TOT_NGHIEP: 'Dự kiến thời gian tốt nghiệp',
  NGAY_LAM_DON: 'Ngày làm đơn',
  THANG_LAM_DON: 'Tháng làm đơn',
  NAM_LAM_DON: 'Năm làm đơn',
  TEN_NGUOI_KY: 'Tên người ký (cán bộ)',
};

const fixOriginalFileName = (originalFileName, tenDon) => {
  const ext = path.extname(originalFileName || '') || '.docx';
  const cleanTenDon = fixTenDonDisplay(tenDon);
  const fixed = decodeUploadFileName(originalFileName);
  if (
    cleanTenDon &&
    (looksMojibake(originalFileName || '') ||
      looksMojibake(fixed) ||
      (!hasVietnamese(fixed) && hasVietnamese(cleanTenDon)))
  ) {
    return cleanTenDon.endsWith(ext) ? cleanTenDon : `${cleanTenDon}${ext}`;
  }
  return fixed || `${cleanTenDon || 'mau-bieu-mau'}${ext}`;
};

const normalizeLoaiDon = (item) => {
  const obj = item.toObject ? item.toObject() : item;
  const tenDon = fixTenDonDisplay(obj.tenDon);
  const eligibility = obj.eligibility || resolveNvqsEligibilityKind({ ...obj, tenDon }) || null;
  return {
    ...obj,
    tenDon,
    originalFileName: fixOriginalFileName(obj.originalFileName, tenDon),
    eligibility,
  };
};

const uploadDocxToCloudinary = (buffer, originalName) =>
  new Promise((resolve, reject) => {
    const safeBase =
      path
        .parse(originalName)
        .name.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-]+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 80) || 'template';
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'word-templates',
        public_id: `${safeBase}-${Date.now()}`,
        format: 'docx',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    stream.end(buffer);
  });

const getCloudinaryPublicIdFromUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^/.]+)?$/);
  return match ? match[1] : null;
};

const isRemoteUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const cleanupTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // ignore
  }
};

/** Đọc placeholder {Ho_Ten} từ buffer DOCX */
const extractPlaceholdersFromBuffer = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  const matches = result.value.match(/\{([^}]+)\}/g) || [];
  const fields = [
    ...new Set(
      matches
        .map((item) => item.replace(/[{}]/g, '').trim())
        .filter(Boolean),
    ),
  ];
  return fields;
};

const buildChiTiet = (fields) =>
  fields.map((item) => ({
    moTa: PLACEHOLDER_LABELS[item] || item,
    placeHolder: item,
  }));

class LoaiDonController {
  /** Admin upload mẫu Word — parse placeholder {field} như feature/Forms */
  async import(req, res) {
    const tempPath = req.file?.path;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn file Word' });
      }
      if (req.file.mimetype && req.file.mimetype !== DOCX_MIME) {
        await cleanupTempFile(tempPath);
        return res.status(400).json({ success: false, message: 'Chỉ hỗ trợ file DOCX' });
      }
      if (!isCloudinaryConfigured()) {
        await cleanupTempFile(tempPath);
        return res.status(500).json({
          success: false,
          message: 'Cloudinary chưa được cấu hình. Kiểm tra CLOUDINARY_* trong .env',
        });
      }

      const buffer = await fs.promises.readFile(tempPath);
      const bodyTenDon =
        typeof req.body?.tenDon === 'string' && req.body.tenDon.trim()
          ? req.body.tenDon.trim()
          : '';
      let originalName = decodeUploadFileName(req.file.originalname);
      if (looksMojibake(originalName) && bodyTenDon) {
        const ext = path.extname(req.file.originalname || '') || '.docx';
        originalName = bodyTenDon.endsWith(ext) ? bodyTenDon : `${bodyTenDon}${ext}`;
      }
      const tenDon = bodyTenDon || path.parse(originalName).name;
      const description =
        typeof req.body?.description === 'string' ? req.body.description.trim() : '';

      const uploadResult = await uploadDocxToCloudinary(buffer, originalName);
      const fields = await extractPlaceholdersFromBuffer(buffer);

      const loaiDon = await LoaiDon.create({
        tenDon,
        templateFile: uploadResult.secure_url,
        sourceType: 'imported_word',
        originalFileName: originalName,
        description: description || undefined,
        chiTiet: buildChiTiet(fields),
      });

      try {
        loaiDon.chatbotIndex = await buildChatbotIndex(loaiDon.toObject(), { buffer });
        await loaiDon.save();
      } catch (indexErr) {
        console.warn('[LoaiDon] chatbot auto-index failed:', indexErr.message);
      }

      await cleanupTempFile(tempPath);

      return res.json({
        success: true,
        data: loaiDon,
        url: uploadResult.secure_url,
        public_id: uploadResult.public_id,
        message: 'Import biểu mẫu thành công',
      });
    } catch (error) {
      await cleanupTempFile(tempPath);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /** Tải mẫu Word gốc */
  async downloadTemplate(req, res) {
    try {
      const loaiDon = await LoaiDon.findById(req.params.id);
      if (!loaiDon) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu' });
      }
      if (!loaiDon.templateFile) {
        return res.status(404).json({ success: false, message: 'Không có file mẫu' });
      }

      const filename = fixOriginalFileName(
        loaiDon.originalFileName,
        fixTenDonDisplay(loaiDon.tenDon),
      );

      if (isRemoteUrl(loaiDon.templateFile)) {
        const response = await axios.get(loaiDon.templateFile, {
          responseType: 'arraybuffer',
          timeout: 60000,
        });
        res.setHeader(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        );
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        return res.send(Buffer.from(response.data));
      }

      if (!fs.existsSync(loaiDon.templateFile)) {
        return res.status(404).json({ success: false, message: 'File mẫu không tồn tại' });
      }
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      return res.sendFile(path.resolve(loaiDon.templateFile));
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAll(req, res) {
    try {
      const { page, limit, skip } = parsePagination(req.query);
      const search = req.query.search || '';
      const query = {};
      if (search) query.tenDon = { $regex: search, $options: 'i' };

      const [data, total] = await Promise.all([
        LoaiDon.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
        LoaiDon.countDocuments(query),
      ]);

      const normalized = data.map((item) => normalizeLoaiDon(item));

      return res.json({
        success: true,
        data: normalized,
        pagination: buildPaginationMeta(total, page, limit),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async getById(req, res) {
    try {
      const loaiDon = await LoaiDon.findById(req.params.id);
      if (!loaiDon) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu' });
      }
      const data = normalizeLoaiDon(loaiDon);
      return res.json({ success: true, data });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async update(req, res) {
    try {
      const { tenDon, description, chiTiet } = req.body;
      const loaiDon = await LoaiDon.findById(req.params.id);
      if (!loaiDon) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu' });
      }
      if (tenDon !== undefined) {
        const trimmed = String(tenDon).trim();
        if (!trimmed) {
          return res.status(400).json({ success: false, message: 'Tên đơn không được để trống' });
        }
        loaiDon.tenDon = trimmed;
      }
      if (description !== undefined) loaiDon.description = description;
      if (req.body.isActive !== undefined) {
        loaiDon.isActive = Boolean(req.body.isActive);
      }

      if (Array.isArray(chiTiet)) {
        loaiDon.chiTiet = loaiDon.chiTiet.map((oldItem) => {
          const updatedItem = chiTiet.find(
            (newItem) => newItem._id === oldItem._id.toString(),
          );
          if (updatedItem) {
            return {
              ...oldItem.toObject(),
              moTa: updatedItem.moTa ?? oldItem.moTa,
            };
          }
          return oldItem;
        });
      }

      const nameOrDescChanged = tenDon !== undefined || description !== undefined;
      if (nameOrDescChanged) {
        try {
          loaiDon.chatbotIndex = await buildChatbotIndex(loaiDon.toObject());
        } catch (indexErr) {
          console.warn('[LoaiDon] chatbot re-index failed:', indexErr.message);
        }
      }

      await loaiDon.save();
      return res.json({
        success: true,
        message: 'Cập nhật thành công',
        data: normalizeLoaiDon(loaiDon),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  async delete(req, res) {
    try {
      const loaiDon = await LoaiDon.findById(req.params.id);
      if (!loaiDon) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu' });
      }
      loaiDon.isActive = false;
      await loaiDon.save();
      return res.json({
        success: true,
        message: 'Đã chuyển mẫu sang ngừng hoạt động',
        data: normalizeLoaiDon(loaiDon),
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  previewFile = async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ success: false, message: 'Missing template URL' });
      }

      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      const zip = new PizZip(Buffer.from(response.data));
      const doc = new Docxtemplater(zip);
      const buffer = doc.getZip().generate({ type: 'nodebuffer' });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader('Content-Disposition', 'inline; filename="output.docx"');
      return res.send(buffer);
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  };

  /** Tải mẫu Excel theo đúng các trường placeHolder của mẫu đơn */
  downloadExcelTemplate = async (req, res) => {
    try {
      const loaiDon = await LoaiDon.findById(req.params.id);
      if (!loaiDon) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu đơn' });
      }
      const buffer = buildExcelTemplateBuffer(loaiDon);
      const safeName = String(loaiDon.tenDon || 'mau-don')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\-]+/g, '_')
        .slice(0, 60);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="import_${safeName || 'mau-don'}.xlsx"`,
      );
      return res.send(buffer);
    } catch (error) {
      const status = error?.statusCode || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  };

  /** Import Excel → tạo hồ sơ hàng loạt (gán theo MSSV) */
  importSubmissions = async (req, res) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel' });
      }
      const result = await importSubmissionsFromExcel({
        loaiDonId: req.params.id,
        buffer: req.file.buffer,
        actorUserId: req.user?.id,
      });
      return res.json({
        success: true,
        message:
          result.errors.length === 0
            ? `Đã tạo ${result.success} hồ sơ từ Excel`
            : `Hoàn tất: ${result.success} thành công, ${result.errors.length} lỗi`,
        data: result,
      });
    } catch (error) {
      const status = error?.statusCode || 500;
      return res.status(status).json({ success: false, message: error.message });
    }
  };
}

export default new LoaiDonController();
