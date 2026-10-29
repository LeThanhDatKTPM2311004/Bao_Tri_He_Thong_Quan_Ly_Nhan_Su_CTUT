import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
}

export function SearchInput({
  placeholder = 'Tìm kiếm...',
  onSearch,
}: SearchInputProps) {
  return (
    <Input.Search
      placeholder={placeholder}
      enterButton={<SearchOutlined />}
      onSearch={onSearch}
      allowClear
    />
  );
}
