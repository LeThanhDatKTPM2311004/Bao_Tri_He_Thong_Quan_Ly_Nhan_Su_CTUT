import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Badge, Button, Card, Col, Descriptions, Row, Space, Spin, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  CloudOutlined,
  DatabaseOutlined,
  GoogleOutlined,
  MailOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { PageHeader } from '@/shared/components/ui/PageHeader';
import { getErrorMessage } from '@/shared/utils/errorHandler';
import { settingsApi, type SystemOverview } from '../services/settingsApi';

const statusColor = (ok: boolean) => (ok ? 'success' : 'error');

function IntegrationCard({
  title,
  ok,
  icon,
  description,
  extra,
}: {
  title: string;
  ok: boolean;
  icon: ReactNode;
  description: string;
  extra?: ReactNode;
}) {
  return (
    <Card className="h-full border border-[var(--app-border)] shadow-none rounded-xl bg-[var(--app-surface)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--app-bg)] flex items-center justify-center text-lg shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-[var(--app-text)]">{title}</div>
            <div className="text-xs text-[var(--app-text-muted)] mt-1 break-words">{description}</div>
            {extra}
          </div>
        </div>
        <Badge status={statusColor(ok)} text={ok ? 'OK' : 'Thiếu'} />
      </div>
    </Card>
  );
}

function OverviewPanel() {
  const [data, setData] = useState<SystemOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await settingsApi.getOverview();
      setData(res.data.data);
    } catch (err) {
      setData(null);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="py-16 flex justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không tải được tổng quan hệ thống"
        description={error}
        action={
          <Button size="small" onClick={() => void load()}>
            Thử lại
          </Button>
        }
      />
    );
  }

  if (!data) return null;

  const serverTimeLabel = new Date(data.system.serverTime).toLocaleString('vi-VN');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Typography.Text className="text-sm text-[var(--app-text-muted)]">
          Trạng thái tích hợp lấy trực tiếp từ cấu hình server đang chạy.
        </Typography.Text>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>
          Làm mới
        </Button>
      </div>

      {error && (
        <Alert type="warning" showIcon closable message={error} onClose={() => setError(null)} />
      )}

      <Card className="border border-[var(--app-border)] rounded-xl bg-[var(--app-surface)]">
        <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small" title="Hệ thống">
          <Descriptions.Item label="Trạng thái API">
            <Tag color="green">Đang chạy</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Môi trường">
            <Tag color={data.system.nodeEnv === 'production' ? 'blue' : 'default'}>
              {data.system.nodeEnv}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Version deploy">{data.system.version}</Descriptions.Item>
          <Descriptions.Item label="Thời gian server">{serverTimeLabel}</Descriptions.Item>
          <Descriptions.Item label="Giới hạn upload">{data.upload.maxFileSizeMb} MB</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="Cơ sở dữ liệu"
            ok={data.database.connected}
            icon={<DatabaseOutlined className="text-[var(--app-accent)]" />}
            description={data.database.label}
            extra={
              data.database.host ? (
                <div className="text-[11px] text-[var(--app-text-muted)] mt-1 font-mono truncate">
                  host: {data.database.host}
                </div>
              ) : null
            }
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="Email"
            ok={data.integrations.email.configured}
            icon={<MailOutlined className="text-amber-600" />}
            description={data.integrations.email.label}
            extra={
              data.integrations.email.from ? (
                <div className="text-[11px] text-[var(--app-text-muted)] mt-1">
                  From: {data.integrations.email.from}
                </div>
              ) : null
            }
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="Google OAuth"
            ok={data.integrations.google.configured}
            icon={<GoogleOutlined className="text-red-500" />}
            description={data.integrations.google.label}
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="Cloudinary"
            ok={data.integrations.cloudinary.configured}
            icon={<CloudOutlined className="text-sky-500" />}
            description={data.integrations.cloudinary.label}
            extra={
              data.integrations.cloudinary.cloudName ? (
                <div className="text-[11px] text-[var(--app-text-muted)] mt-1 font-mono">
                  {data.integrations.cloudinary.cloudName}
                </div>
              ) : null
            }
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="Chữ ký số CA"
            ok={data.integrations.ca.configured}
            icon={<SafetyCertificateOutlined className="text-emerald-500" />}
            description={data.integrations.ca.label}
            extra={
              <Tag className="mt-2" color={data.integrations.ca.mode === 'live' ? 'green' : 'orange'}>
                {data.integrations.ca.mode}
              </Tag>
            }
          />
        </Col>
        <Col xs={24} md={12} xl={8}>
          <IntegrationCard
            title="API Backend"
            ok
            icon={<ApiOutlined className="text-[var(--app-accent)]" />}
            description={`Version ${data.system.version}`}
          />
        </Col>
      </Row>

      <Card className="border border-[var(--app-border)] rounded-xl bg-[var(--app-surface)]" title="Cổng giao diện">
        <Space direction="vertical" size="middle" className="w-full">
          <div>
            <div className="text-xs font-semibold text-[var(--app-text-muted)] mb-1">Admin portal</div>
            <Typography.Link href={data.portals.adminPortalUrl} target="_blank" rel="noreferrer">
              {data.portals.adminPortalUrl}
            </Typography.Link>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--app-text-muted)] mb-1">Student portal</div>
            <Typography.Link href={data.portals.studentPortalUrl} target="_blank" rel="noreferrer">
              {data.portals.studentPortalUrl}
            </Typography.Link>
          </div>
          {data.portals.clientUrls.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[var(--app-text-muted)] mb-1">CLIENT_URL list</div>
              <div className="flex flex-wrap gap-2">
                {data.portals.clientUrls.map((url) => (
                  <Tag key={url} className="whitespace-normal break-all m-0">
                    {url}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </Space>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Cài đặt hệ thống"
        subtitle="Theo dõi trạng thái tích hợp và cổng giao diện đang chạy"
      />
      <Card className="border border-[var(--app-border)] rounded-xl shadow-none bg-[var(--app-surface)]">
        <OverviewPanel />
      </Card>
    </div>
  );
}
