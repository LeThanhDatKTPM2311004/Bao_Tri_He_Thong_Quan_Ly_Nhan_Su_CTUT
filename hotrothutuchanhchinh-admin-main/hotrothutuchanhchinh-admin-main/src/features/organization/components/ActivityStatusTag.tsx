import { Tag } from 'antd';

/** Trạng thái hoạt động (isActive) dùng chung trang tổ chức */
export function ActivityStatusTag({ active }: { active?: boolean | null }) {
  const isOn = active !== false;
  return (
    <Tag color={isOn ? 'success' : 'default'}>
      {isOn ? 'Đang hoạt động' : 'Ngừng hoạt động'}
    </Tag>
  );
}
