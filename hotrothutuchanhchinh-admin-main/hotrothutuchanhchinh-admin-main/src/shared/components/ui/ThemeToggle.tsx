import { MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { useTheme } from '@/app/providers/ThemeProvider';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const dim = size === 'sm' ? 'w-9 h-9' : 'w-10 h-10';

  return (
    <Tooltip title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}>
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? 'Bật chế độ sáng' : 'Bật chế độ tối'}
        className={`${dim} rounded-lg flex items-center justify-center border transition-colors shadow-sm
          bg-[var(--app-surface)] border-[var(--app-border)]
          text-[var(--app-text-muted)] hover:bg-[var(--app-accent-soft)] ${className}`}
      >
        {isDark ? (
          <SunOutlined className="text-[var(--app-accent)] text-base" />
        ) : (
          <MoonOutlined className="text-[var(--app-text-muted)] text-base" />
        )}
      </button>
    </Tooltip>
  );
}
