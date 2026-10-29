import { formatExcelFormValue } from '../../src/modules/organization/importRowUtils.js';
import {
  buildColumnMapping,
  getImportableFields,
  isImageOrSignaturePlaceholder,
} from '../../src/modules/importForms/bulkFormImport.service.js';
describe('bulkFormImport mapping', () => {
  const fields = [
    { placeHolder: 'MSSV', moTa: 'Mã SV' },
    { placeHolder: 'HO_TEN', moTa: 'Họ tên' },
    { placeHolder: 'KHOA', moTa: 'Khoa' },
  ];

  test('khớp cột gần đúng + bỏ cột dư', () => {
    const result = buildColumnMapping(['Mã SV', 'Họ và tên', 'Ghi chú', 'Điểm TB'], fields);
    expect(result.mapping.MSSV).toBeDefined();
    expect(result.mapping.HO_TEN).toBeDefined();
    expect(result.hasIdentityColumn).toBe(true);
    expect(result.unmatchedHeaders).toEqual(expect.arrayContaining(['Ghi chú', 'Điểm TB']));
    expect(result.unmatchedFields).toContain('KHOA');
  });

  test('thiếu MSSV/Email thì không có cột định danh', () => {
    const result = buildColumnMapping(['Họ tên', 'Khoa'], fields);
    expect(result.hasIdentityColumn).toBe(false);
  });

  test('bỏ placeholder chữ ký / ảnh', () => {
    expect(isImageOrSignaturePlaceholder('%CHU_KY')).toBe(true);
    expect(isImageOrSignaturePlaceholder('CHU_KY_HIEU_TRUONG')).toBe(true);
    expect(isImageOrSignaturePlaceholder('MSSV')).toBe(false);
  });

  test('getImportableFields lọc chữ ký', () => {
    const list = getImportableFields({
      chiTiet: [
        { placeHolder: 'MSSV', moTa: 'Mã' },
        { placeHolder: 'CHU_KY', moTa: 'Ký' },
      ],
    });
    expect(list.map((f) => f.placeHolder)).toEqual(['MSSV']);
  });

  test('số serial Excel THOI_GIAN_TOT_NGHIEP thành tháng/năm', () => {
    expect(formatExcelFormValue(47635, 'THOI_GIAN_TOT_NGHIEP')).toBe('06/2030');
    expect(formatExcelFormValue('09/2024', 'THOI_GIAN_NHAP_HOC')).toBe('09/2024');
    expect(formatExcelFormValue(2026, 'KHOA_HOC')).toBe('2026');
  });
});
