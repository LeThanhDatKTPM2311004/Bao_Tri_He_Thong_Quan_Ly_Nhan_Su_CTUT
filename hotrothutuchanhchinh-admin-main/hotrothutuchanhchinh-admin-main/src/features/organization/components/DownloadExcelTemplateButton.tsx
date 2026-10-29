import { useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import * as XLSXNS from 'xlsx';
import {
  SINH_VIEN_EXCEL_GUIDES,
  SINH_VIEN_EXCEL_HEADERS,
  buildSinhVienExcelSample,
  type SinhVienExcelPrefill,
} from '../constants/sinhVienExcelTemplate';

const XLSX = (XLSXNS as { default?: typeof XLSXNS }).default ?? XLSXNS;

export type ExcelTemplateKind = 'khoa' | 'bo-mon' | 'giang-vien' | 'lop' | 'sinh-vien' | 'quyen';

const TEMPLATE_FILES: Record<ExcelTemplateKind, { href: string; fileName: string }> = {
  khoa: {
    href: '/mau-import-excel/mau-khoa.xlsx',
    fileName: 'mau-khoa.xlsx',
  },
  'bo-mon': {
    href: '/mau-import-excel/mau-bo-mon.xlsx',
    fileName: 'mau-bo-mon.xlsx',
  },
  'giang-vien': {
    href: '/mau-import-excel/mau-giang-vien.xlsx',
    fileName: 'mau-giang-vien.xlsx',
  },
  lop: {
    href: '/mau-import-excel/mau-lop.xlsx',
    fileName: 'mau-lop.xlsx',
  },
  'sinh-vien': {
    href: '/mau-import-excel/mau-sinh-vien.xlsx',
    fileName: 'mau-sinh-vien.xlsx',
  },
  quyen: {
    href: '/mau-import-excel/mau-quyen.xlsx',
    fileName: 'mau-quyen.xlsx',
  },
};

const HD = (text: string) => `[HD] ${text}`;

const safeFilePart = (value: string) => value.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40);

function writePrefillWorkbook(
  sheetName: string,
  fileName: string,
  headers: string[],
  guides: string[],
  sample: string[],
) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, guides.map(HD), sample]);
  ws['!cols'] = headers.map((h, i) => ({
    wch: Math.min(48, Math.max(14, String(h).length + 2, Math.ceil(String(guides[i] || '').length * 0.55))),
  }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/** Tạo mẫu bộ môn với cột Tên khoa đã điền theo khoa đang chọn trên UI */
function downloadBoMonTemplateWithKhoa(khoaName: string) {
  writePrefillWorkbook(
    'BoMon',
    `mau-bo-mon-${safeFilePart(khoaName) || 'khoa'}.xlsx`,
    ['Tên khoa', 'Tên bộ môn', 'Mô tả'],
    [
      'Đã điền theo khoa đang chọn trên giao diện. Có thể sửa nếu cần.',
      'Bắt buộc. Tên bộ môn đầy đủ. Vd: Kết cấu công trình',
      'Không bắt buộc. Mô tả ngắn về bộ môn',
    ],
    [khoaName, 'Kết cấu công trình', ''],
  );
}

/** Tạo mẫu lớp với cột Tên khoa / Tên bộ môn đã điền theo lựa chọn trên UI */
function downloadLopTemplateWithOrg(khoaName: string, boMonName: string) {
  const year = String(new Date().getFullYear());
  writePrefillWorkbook(
    'Lop',
    `mau-lop-${safeFilePart(boMonName) || safeFilePart(khoaName) || 'lop'}.xlsx`,
    ['Tên khoa', 'Tên bộ môn', 'Tên lớp', 'Niên khóa', 'Cố vấn'],
    [
      'Đã điền theo khoa đang chọn trên giao diện. Có thể sửa nếu cần.',
      'Đã điền theo bộ môn đang chọn trên giao diện. Có thể sửa nếu cần.',
      'Bắt buộc. Tên lớp đầy đủ. Vd: Kết cấu 2024',
      'Không bắt buộc. Niên khóa 4 chữ số. Vd: 2024',
      'Không bắt buộc. Họ tên hoặc mã GV cố vấn đã có.',
    ],
    [khoaName, boMonName, '', year, ''],
  );
}

/** Tạo mẫu GV với cột Tên khoa / Tên bộ môn đã điền theo bộ lọc trên UI */
function downloadGiangVienTemplateWithOrg(khoaName: string, boMonName: string) {
  writePrefillWorkbook(
    'GiangVien',
    `mau-giang-vien-${safeFilePart(boMonName) || safeFilePart(khoaName) || 'gv'}.xlsx`,
    ['Họ tên', 'Email', 'SĐT', 'Tên khoa', 'Tên bộ môn', 'Lớp cố vấn'],
    [
      'Bắt buộc. Họ tên đầy đủ, có dấu. Vd: Nguyễn Văn A',
      'Bắt buộc. Email thường (Gmail…), không dùng @student.ctuet.edu.vn. Vd: nva@gmail.com',
      'Không bắt buộc. Bắt đầu bằng 0, 10–11 số. Vd: 0901234567',
      'Đã điền theo khoa đang chọn trên giao diện. Có thể sửa nếu cần.',
      'Đã điền theo bộ môn đang chọn trên giao diện. Có thể sửa nếu cần.',
      'Không bắt buộc. Tên lớp hoặc mã lớp đã có; nhiều lớp cách nhau bằng dấu phẩy',
    ],
    ['Nguyễn Văn A', 'nguyenvana@gmail.com', '0901234567', khoaName, boMonName, ''],
  );
}

function downloadSinhVienTemplate(prefill: SinhVienExcelPrefill = {}) {
  const hasContext = Boolean(prefill.lopName || prefill.khoaName || prefill.boMonName);
  writePrefillWorkbook(
    'SinhVien',
    `mau-sinh-vien${prefill.lopName ? `-${safeFilePart(prefill.lopName)}` : ''}.xlsx`,
    [...SINH_VIEN_EXCEL_HEADERS],
    [...SINH_VIEN_EXCEL_GUIDES],
    buildSinhVienExcelSample(prefill),
  );
  return hasContext;
}

interface DownloadExcelTemplateButtonProps {
  kind: ExcelTemplateKind;
  size?: 'small' | 'middle' | 'large';
  /** Khi tải mẫu bộ môn / lớp / SV: điền sẵn cột Tên khoa */
  khoaName?: string;
  /** Khi tải mẫu lớp / SV: điền sẵn cột Tên bộ môn */
  boMonName?: string;
  /** Khi tải mẫu SV: điền sẵn lớp / khóa học */
  lopName?: string;
  khoaHoc?: string;
}

export function DownloadExcelTemplateButton({
  kind,
  size = 'middle',
  khoaName,
  boMonName,
  lopName,
  khoaHoc,
}: DownloadExcelTemplateButtonProps) {
  const template = TEMPLATE_FILES[kind];
  const [loading, setLoading] = useState(false);

  const trimmedKhoa = khoaName?.trim() || '';
  const trimmedBoMon = boMonName?.trim() || '';
  const trimmedLop = lopName?.trim() || '';
  const trimmedKhoaHoc = khoaHoc?.trim() || '';
  const prefillBoMon = kind === 'bo-mon' && Boolean(trimmedKhoa);
  const prefillLop = kind === 'lop' && Boolean(trimmedKhoa) && Boolean(trimmedBoMon);
  const prefillGiangVien = kind === 'giang-vien' && Boolean(trimmedKhoa) && Boolean(trimmedBoMon);
  const prefillSinhVien = kind === 'sinh-vien';
  const usePrefill = prefillBoMon || prefillLop || prefillGiangVien || prefillSinhVien;

  const handlePrefillDownload = () => {
    try {
      setLoading(true);
      if (prefillBoMon) {
        downloadBoMonTemplateWithKhoa(trimmedKhoa);
      } else if (prefillLop) {
        downloadLopTemplateWithOrg(trimmedKhoa, trimmedBoMon);
      } else if (prefillGiangVien) {
        downloadGiangVienTemplateWithOrg(trimmedKhoa, trimmedBoMon);
      } else if (prefillSinhVien) {
        downloadSinhVienTemplate({
          lopName: trimmedLop,
          khoaName: trimmedKhoa,
          boMonName: trimmedBoMon,
          khoaHoc: trimmedKhoaHoc,
        });
      }
    } catch {
      message.error('Không tạo được file mẫu. Thử lại hoặc tải mẫu mặc định.');
    } finally {
      setLoading(false);
    }
  };

  const tooltipTitle = prefillGiangVien
    ? `File mẫu sẽ có sẵn Tên khoa: ${trimmedKhoa} và Tên bộ môn: ${trimmedBoMon}`
    : prefillSinhVien
      ? trimmedLop
        ? `File mẫu đồng bộ form thêm SV; đã điền sẵn Lớp/Khoa/Bộ môn/Khóa học theo lớp đang chọn`
        : 'File mẫu đồng bộ form thêm SV (cột bắt buộc / combobox giống giao diện)'
      : prefillLop
        ? `File mẫu sẽ có sẵn Tên khoa: ${trimmedKhoa} và Tên bộ môn: ${trimmedBoMon}`
        : prefillBoMon
          ? `File mẫu sẽ có sẵn Tên khoa: ${trimmedKhoa}`
          : 'File mẫu có dòng hướng dẫn [HD] dưới mỗi cột — hệ thống bỏ qua dòng đó khi import';

  return (
    <Tooltip title={tooltipTitle}>
      {usePrefill ? (
        <Button
          icon={<DownloadOutlined />}
          size={size}
          loading={loading}
          onClick={handlePrefillDownload}
        >
          Tải mẫu Excel
        </Button>
      ) : (
        <Button icon={<DownloadOutlined />} size={size} href={template.href} download={template.fileName}>
          Tải mẫu Excel
        </Button>
      )}
    </Tooltip>
  );
}
