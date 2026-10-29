import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { ImportExcelButton } from '@/features/organization/components/ImportExcelButton';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { wordTemplatesApi } from '../services/formsApi';
import type { ImportedForm } from '../types/forms.types';

const isSignatureField = (placeHolder?: string) => {
  const raw = String(placeHolder || '').trim();
  if (!raw) return true;
  if (raw.startsWith('%')) return true;
  const upper = raw.toUpperCase();
  return upper.startsWith('CHU_KY') || upper.includes('CHU_KY_');
};

export function BulkFormImportPage() {
  const [forms, setForms] = useState<ImportedForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedForm, setSelectedForm] = useState<ImportedForm | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    try {
      const res = await wordTemplatesApi.list();
      const list = (res.data.data || []).filter((f) => f.isActive !== false);
      setForms(list);
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không tải được danh sách mẫu đơn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadForms();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelectedForm(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    wordTemplatesApi
      .get(selectedId)
      .then((res) => {
        if (!cancelled) setSelectedForm(res.data.data || null);
      })
      .catch((error) => {
        if (!cancelled) {
          message.error(getErrorMessage(error) || 'Không tải được chi tiết mẫu đơn');
          setSelectedForm(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const importableFields = useMemo(() => {
    const details = selectedForm?.chiTiet || [];
    const fields = details.filter((d) => !isSignatureField(d.placeHolder));
    const hasMssv = fields.some((f) => String(f.placeHolder).toUpperCase() === 'MSSV');
    if (!hasMssv) {
      return [{ _id: 'mssv', placeHolder: 'MSSV', moTa: 'Mã số sinh viên (bắt buộc)' }, ...fields];
    }
    return fields;
  }, [selectedForm]);

  const formOptions = useMemo(
    () =>
      forms.map((f) => ({
        value: f._id,
        label: f.tenDon,
      })),
    [forms],
  );

  const handleDownloadTemplate = async () => {
    if (!selectedId) {
      message.warning('Vui lòng chọn mẫu đơn trước');
      return;
    }
    setDownloading(true);
    try {
      await wordTemplatesApi.downloadExcelTemplate(
        selectedId,
        `import-${selectedForm?.tenDon || 'mau-don'}.xlsx`,
      );
    } catch (error) {
      message.error(getErrorMessage(error) || 'Không tải được mẫu Excel');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nhập đơn từ Excel"
        subtitle="Chọn mẫu đơn → tải file Excel đúng cột → import để hệ thống tạo hồ sơ và chạy quy trình duyệt (sinh viên không cần tự điền)."
      />

      <Card>
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <Typography.Text strong>Mẫu đơn</Typography.Text>
            <Select
              className="w-full mt-2"
              showSearch
              optionFilterProp="label"
              loading={loading}
              placeholder="Chọn mẫu đơn để import"
              options={formOptions}
              value={selectedId}
              onChange={(value) => setSelectedId(value)}
              allowClear
            />
          </div>

          <Space wrap>
            <Button
              icon={<DownloadOutlined />}
              disabled={!selectedId}
              loading={downloading}
              onClick={() => void handleDownloadTemplate()}
            >
              Tải mẫu Excel
            </Button>
            <ImportExcelButton
              guard={() => (!selectedId ? 'Vui lòng chọn mẫu đơn trước khi import' : null)}
              onImport={async (file) => {
                if (!selectedId) throw new Error('Chưa chọn mẫu đơn');
                const res = await wordTemplatesApi.importSubmissions(selectedId, file);
                const data = res.data?.data;
                if (data?.matchedPlaceholders?.length) {
                  message.info(
                    `Đã khớp ${data.matchedPlaceholders.length} trường: ${data.matchedPlaceholders.join(', ')}` +
                      (data.missingPlaceholders?.length
                        ? `. Để trống: ${data.missingPlaceholders.join(', ')}`
                        : '') +
                      (data.unexpectedHeaders?.length
                        ? `. Bỏ qua cột dư: ${data.unexpectedHeaders.slice(0, 8).join(', ')}`
                        : ''),
                    8,
                  );
                }
                return res;
              }}
            />
          </Space>
        </Space>
      </Card>

      <Card
        title={
          <Space>
            <FileExcelOutlined />
            <span>Các cột Excel cần có</span>
            {selectedForm ? <Tag color="blue">{selectedForm.tenDon}</Tag> : null}
          </Space>
        }
        loading={loadingDetail}
      >
        {!selectedId ? (
          <Typography.Text type="secondary">Chọn mẫu đơn để xem danh sách cột.</Typography.Text>
        ) : (
          <Table
            size="small"
            rowKey={(r) => r.placeHolder}
            pagination={false}
            dataSource={importableFields}
            columns={[
              {
                title: 'Tên cột Excel (placeHolder)',
                dataIndex: 'placeHolder',
                render: (v: string) => <Tag>{v}</Tag>,
              },
              {
                title: 'Mô tả',
                dataIndex: 'moTa',
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
