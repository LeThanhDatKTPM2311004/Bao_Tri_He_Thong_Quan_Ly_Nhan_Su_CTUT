import { Tooltip, Typography } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

type CellTextProps = {
  children?: ReactNode;
  /** Nội dung đầy đủ hiện khi hover (mặc định = children nếu là string) */
  title?: string;
  className?: string;
  style?: CSSProperties;
  /** Số dòng tối đa trước khi cắt (1 = một dòng) */
  lines?: 1 | 2 | 3;
  /** Font mono cho email / mã */
  mono?: boolean;
  strong?: boolean;
};

/**
 * Text trong bảng / list — cắt gọn khi dài, hover xem đủ, xuống dòng an toàn trên mobile.
 */
export function CellText({
  children,
  title,
  className = '',
  style,
  lines = 1,
  mono = false,
  strong = false,
}: CellTextProps) {
  const tip =
    title ??
    (typeof children === 'string' || typeof children === 'number' ? String(children) : undefined);

  const sharedClass = ['app-cell-text', mono ? 'font-mono text-xs' : '', className]
    .filter(Boolean)
    .join(' ');

  const content =
    lines === 1 ? (
      <Typography.Text
        strong={strong}
        ellipsis
        className={sharedClass}
        style={{ margin: 0, maxWidth: '100%', ...style }}
      >
        {children ?? '—'}
      </Typography.Text>
    ) : (
      <Typography.Paragraph
        strong={strong}
        ellipsis={{ rows: lines }}
        className={sharedClass}
        style={{ margin: 0, maxWidth: '100%', ...style }}
      >
        {children ?? '—'}
      </Typography.Paragraph>
    );

  if (!tip || tip === '—' || tip === '') return content;

  return (
    <Tooltip title={tip} placement="topLeft" mouseEnterDelay={0.35}>
      <span className="app-cell-text-wrap block max-w-full">{content}</span>
    </Tooltip>
  );
}
