import { Upload, Button, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { ImportResult } from '../types/organization.types';
import { showImportFeedback } from '../utils/formatImportFeedback';
import { getErrorMessage } from '@/shared/utils/errorHandler';

interface ImportExcelButtonProps {
  onImport: (file: File) => Promise<{ data: { data: ImportResult } }>;
  onDone?: () => void;
  /** Trả về chuỗi cảnh báo để chặn chọn file; null/undefined = cho phép. */
  guard?: () => string | null | undefined;
  size?: 'small' | 'middle' | 'large';
}

export function ImportExcelButton({ onImport, onDone, guard, size }: ImportExcelButtonProps) {
  const blockIfNeeded = (e?: { preventDefault: () => void; stopPropagation: () => void }) => {
    const warning = guard?.();
    if (!warning) return false;
    e?.preventDefault();
    e?.stopPropagation();
    message.warning(warning);
    return true;
  };

  return (
    <span
      onClickCapture={(e) => {
        blockIfNeeded(e);
      }}
    >
      <Upload
        accept=".xlsx,.xls,.csv"
        showUploadList={false}
        beforeUpload={(file) => {
          if (blockIfNeeded()) return Upload.LIST_IGNORE;
          onImport(file)
            .then((res) => {
              const { success, errors } = res.data.data;
              showImportFeedback(success, errors ?? []);
              onDone?.();
            })
            .catch((err: unknown) => {
              message.error(
                getErrorMessage(err) ||
                  'Không thể đọc/upload file. Kiểm tra file .xlsx và thử lại.',
              );
            });
          return false;
        }}
      >
        <Button icon={<UploadOutlined />} size={size}>
          Import Excel
        </Button>
      </Upload>
    </span>
  );
}
