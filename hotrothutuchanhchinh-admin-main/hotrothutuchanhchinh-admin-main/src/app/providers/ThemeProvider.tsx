import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { getAntdTheme, type ThemeMode } from '@/shared/constants/antdTheme';
import { applyTheme, getStoredTheme, toggleThemeMode } from '@/shared/utils/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => toggleThemeMode(prev));
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    setMode(next);
  }, []);

  const value = useMemo(
    () => ({ mode, isDark: mode === 'dark', toggleTheme, setTheme }),
    [mode, toggleTheme, setTheme],
  );

  const antdTheme = useMemo(() => getAntdTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={viVN} theme={antdTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
