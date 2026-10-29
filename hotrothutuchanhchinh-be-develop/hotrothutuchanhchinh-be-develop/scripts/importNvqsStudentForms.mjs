/**
 * Import 2 mẫu NVQS (thường + trễ hạn) vào MongoDB + Cloudinary.
 * Chạy: node scripts/importNvqsStudentForms.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import mammoth from 'mammoth';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mauDir = path.resolve(__dirname, '../../client/public/mau-word');

const PLACEHOLDER_LABELS = {
  HO_TEN: 'Họ và tên sinh viên',
  NGAY_SINH: 'Ngày, tháng, năm sinh',
  CCCD: 'Số CMND/CCCD',
  NOI_CAP_CCCD: 'Nơi cấp CCCD',
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

const FORMS = [
  {
    file: 'Giay_xac_nhan_tam_hoan_NVQS.docx',
    tenDon: 'Giấy xác nhận tạm hoãn NVQS',
    description: 'Giấy xác nhận tạm hoãn nghĩa vụ quân sự (mẫu thường) — sinh viên điền và nộp.',
  },
  {
    file: 'Giay_xac_nhan_tam_hoan_NVQS_tre_han.docx',
    tenDon: 'Giấy xác nhận tạm hoãn NVQS (trễ hạn)',
    description:
      'Giấy xác nhận tạm hoãn NVQS cho sinh viên học bổ sung / xét tốt nghiệp (mẫu trễ hạn).',
  },
];

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const extractFields = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  const matches = result.value.match(/\{([^}]+)\}/g) || [];
  return [
    ...new Set(
      matches
        .map((item) => item.replace(/[{}]/g, '').trim())
        .filter(Boolean),
    ),
  ];
};

await mongoose.connect(process.env.MONGO_URI);
const LoaiDon = mongoose.connection.collection('loaidons');

for (const form of FORMS) {
  const filePath = path.join(mauDir, form.file);
  if (!fs.existsSync(filePath)) {
    console.error('MISSING', filePath);
    continue;
  }
  const buffer = fs.readFileSync(filePath);
  const fields = await extractFields(buffer);
  console.log(`\n== ${form.tenDon} ==`);
  console.log('fields:', fields.join(', '));

  const upload = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'tthc/word-templates',
        public_id: path.parse(form.file).name,
        overwrite: true,
      },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });

  const chiTiet = fields.map((ph) => ({
    moTa: PLACEHOLDER_LABELS[ph] || ph,
    placeHolder: ph,
  }));

  const existing = await LoaiDon.findOne({ tenDon: form.tenDon });
  const payload = {
    tenDon: form.tenDon,
    templateFile: upload.secure_url,
    sourceType: 'imported_word',
    originalFileName: form.file,
    description: form.description,
    chiTiet,
    isActive: true,
    updatedAt: new Date(),
  };

  if (existing) {
    await LoaiDon.updateOne({ _id: existing._id }, { $set: payload });
    console.log('UPDATED', existing._id.toString(), upload.secure_url);
  } else {
    const doc = {
      ...payload,
      createdAt: new Date(),
    };
    const inserted = await LoaiDon.insertOne(doc);
    console.log('INSERTED', inserted.insertedId.toString(), upload.secure_url);
  }
}

await mongoose.disconnect();
console.log('\nDone. Admin: cấu hình quy trình cho từng mẫu → sinh viên sẽ thấy trên Home.');
