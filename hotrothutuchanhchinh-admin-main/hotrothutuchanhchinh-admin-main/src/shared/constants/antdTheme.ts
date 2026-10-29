import { theme } from 'antd';
import type { ThemeConfig } from 'antd';

export type ThemeMode = 'light' | 'dark';

/** Cobalt / modern-minimal — Be Vietnam Pro (dấu tiếng Việt rõ, phù hợp HTTT hành chính) */
const fontFamily = `'Be Vietnam Pro', 'Segoe UI', 'Roboto', sans-serif`;

/** Cobalt primary — sâu hơn blue-500 mặc định, ít “startup purple” */
const COBALT = '#155eef';
const COBALT_HOVER = '#1248c9';

const shared = {
  borderRadius: 8,
  fontFamily,
  colorPrimary: COBALT,
  colorInfo: COBALT,
  colorSuccess: '#059669',
  colorWarning: '#d97706',
  colorError: '#dc2626',
  controlHeight: 36,
  fontSize: 14,
};

export const lightAntdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...shared,
    colorBgLayout: '#f1f4f8',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748b',
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#eef2f6',
    colorLink: COBALT,
    colorLinkHover: COBALT_HOVER,
  },
  components: {
    Layout: { bodyBg: '#f1f4f8', headerBg: '#ffffff', siderBg: '#ffffff' },
    Menu: {
      itemBg: 'transparent',
      itemColor: '#475569',
      itemSelectedBg: '#e8eefc',
      itemSelectedColor: COBALT_HOVER,
      itemHoverBg: '#f1f5f9',
      itemHoverColor: '#0f172a',
      itemBorderRadius: 8,
      activeBarBorderWidth: 0,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#334155',
      rowHoverBg: '#f1f5f9',
      borderColor: '#e2e8f0',
    },
    Card: { colorBgContainer: '#ffffff', borderRadiusLG: 10 },
    Input: {
      colorBgContainer: '#ffffff',
      colorBorder: '#cbd5e1',
      activeBorderColor: COBALT,
      hoverBorderColor: '#93b4f8',
      borderRadius: 8,
    },
    Select: {
      colorBgContainer: '#ffffff',
      optionSelectedBg: '#e8eefc',
      borderRadius: 8,
    },
    Modal: { contentBg: '#ffffff', headerBg: '#ffffff', borderRadiusLG: 12 },
    Button: {
      primaryShadow: 'none',
      borderRadius: 8,
      fontWeight: 600,
    },
    Tag: { borderRadiusSM: 6 },
  },
};

export const darkAntdTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...shared,
    colorPrimary: '#5b8def',
    colorBgLayout: '#0b1220',
    colorBgContainer: '#141c2b',
    colorBgElevated: '#1a2436',
    colorText: '#f1f5f9',
    colorTextSecondary: '#cbd5e1',
    colorTextTertiary: '#94a3b8',
    colorTextPlaceholder: '#64748b',
    colorBorder: '#2a3548',
    colorBorderSecondary: '#1e293b',
    colorLink: '#93b4f8',
    colorLinkHover: '#bfdbfe',
    colorFillSecondary: '#1e293b',
    colorFillTertiary: '#141c2b',
  },
  components: {
    Layout: { bodyBg: '#0b1220', headerBg: '#141c2b', siderBg: '#141c2b' },
    Menu: {
      darkItemBg: 'transparent',
      darkItemColor: '#cbd5e1',
      darkItemSelectedBg: '#1a2f55',
      darkItemSelectedColor: '#bfdbfe',
      darkItemHoverBg: '#1e293b',
      darkItemHoverColor: '#f8fafc',
      itemBorderRadius: 8,
    },
    Table: {
      headerBg: '#1a2436',
      headerColor: '#e2e8f0',
      colorBgContainer: '#141c2b',
      rowHoverBg: '#1e293b',
      borderColor: '#2a3548',
      colorText: '#f1f5f9',
    },
    Card: { colorBgContainer: '#141c2b', borderRadiusLG: 10 },
    Input: {
      colorBgContainer: '#1a2436',
      colorText: '#f1f5f9',
      colorTextPlaceholder: '#64748b',
      colorBorder: '#334155',
      activeBorderColor: '#5b8def',
      hoverBorderColor: '#93b4f8',
      addonBg: '#141c2b',
    },
    Select: {
      colorBgContainer: '#1a2436',
      colorText: '#f1f5f9',
      colorTextPlaceholder: '#64748b',
      colorBorder: '#334155',
      optionSelectedBg: '#1a2f55',
      optionActiveBg: '#1e293b',
      selectorBg: '#1a2436',
    },
    InputNumber: {
      colorBgContainer: '#1a2436',
      colorText: '#f1f5f9',
      colorBorder: '#334155',
      addonBg: '#141c2b',
    },
    Modal: { contentBg: '#141c2b', headerBg: '#141c2b', borderRadiusLG: 12 },
    Button: { primaryShadow: 'none', borderRadius: 8, fontWeight: 600 },
    Tag: {
      defaultBg: '#1e293b',
      defaultColor: '#e2e8f0',
      borderRadiusSM: 6,
    },
  },
};

export function getAntdTheme(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkAntdTheme : lightAntdTheme;
}
