import { Grid } from 'antd';

const { useBreakpoint: useAntBreakpoint } = Grid;

export function useBreakpoint() {
  const screens = useAntBreakpoint();

  const hasMatched = Object.values(screens).some(Boolean);
  const isDesktop = !hasMatched || Boolean(screens.lg);
  const isTablet = hasMatched && Boolean(screens.md && !screens.lg);
  const isMobile = hasMatched && !screens.lg;

  return {
    screens,
    isMobile,
    isTablet,
    isDesktop,
  };
}
