export interface Khoa {
  _id: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface BoMon {
  _id: string;
  code: string;
  name: string;
  khoaId: string | Khoa;
  description?: string;
  isActive: boolean;
}

export interface Lop {
  _id: string;
  code: string;
  name: string;
  khoaId: string | Khoa;
  boMonId: string | BoMon;
  academicYear?: string;
  /** Cố vấn học tập — có thể populate thành GiangVien */
  coVanId?: string | GiangVien | null;
  isActive: boolean;
}

export interface SinhVien {
  _id: string;
  maSV: string;
  maHoSo?: string;
  fullName: string;
  gender?: 'male' | 'female' | 'other' | null;
  status?: string;
  ngayVaoTruong?: string | null;
  lopHoc?: string;
  coSo?: string;
  dienDaoTao?: string;
  loaiHinhDaoTao?: string;
  nganh?: string;
  chuyenNganh?: string;
  khoaHoc?: string;
  dateOfBirth?: string | null;
  danToc?: string;
  tonGiao?: string;
  quocTich?: string;
  khuVuc?: string;
  soCCCD?: string;
  ngayCapCCCD?: string | null;
  noiCapCCCD?: string;
  doiTuong?: string;
  chinhSach?: string;
  ngayVaoDoan?: string | null;
  ngayVaoDang?: string | null;
  email?: string;
  phone?: string;
  diaChiLienHe?: string;
  noiSinh?: string;
  diaChiThuongTru?: string;
  tenNganHang?: string;
  tenChiNhanh?: string;
  tenChuTaiKhoan?: string;
  soTaiKhoan?: string;
  hoTenCha?: string;
  namSinhCha?: string;
  ngheNgiepCha?: string;
  sdtCha?: string;
  hoTenMe?: string;
  namSinhMe?: string;
  ngheNgiepMe?: string;
  sdtMe?: string;
  nguyenQuan?: string;
  quanHuyen?: string;
  phuongXa?: string;
  tenTinh?: string;
  tenHuyen?: string;
  tenPhanHe?: string;
  truongTotNghiep?: string;
  nienKhoa?: string;
  ghiChu?: string;
  khoaId: string | Khoa;
  boMonId: string | BoMon;
  lopId: string | Lop;
  isActive: boolean;
}

export interface GiangVien {
  _id: string;
  maGV: string;
  fullName: string;
  email?: string;
  phone?: string;
  khoaId: string | Khoa;
  boMonId: string | BoMon;
  /** Các lớp mà giảng viên đang làm cố vấn (từ Lop.coVanId) */
  lopCoVans?: Array<{ _id: string; code: string; name: string }>;
  isActive: boolean;
}

export interface Quyen {
  _id: string;
  code: string;
  name: string;
  group?: string;
  description?: string;
  isActive: boolean;
}

export interface GiangVienQuyen {
  _id: string;
  giangVienId: string | GiangVien;
  quyenId: string | Quyen;
  khoaId?: string | Khoa;
  boMonId?: string | BoMon;
  isActive: boolean;
}

export interface ImportError {
  row: number;
  message: string;
  code?: 'MISSING_BOMON' | 'MISSING_KHOA' | 'MISSING_LOP' | 'MISSING_FIELDS' | 'WRONG_FILE' | 'VALIDATION' | string;
  detail?: { name?: string };
}

export interface ImportResult {
  success: number;
  errors: ImportError[];
}

export const refName = (ref: string | { name?: string; code?: string } | undefined) => {
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  return ref.name || ref.code || '—';
};
