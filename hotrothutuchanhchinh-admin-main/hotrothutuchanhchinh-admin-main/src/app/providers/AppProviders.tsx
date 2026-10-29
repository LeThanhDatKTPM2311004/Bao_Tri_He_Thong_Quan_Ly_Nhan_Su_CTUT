import { Provider } from 'react-redux';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { store } from '@/store';
import { ThemeProvider } from './ThemeProvider';
import { AuthProvider } from './AuthProvider';
import { NetworkStatusNotifier } from '@/shared/components/ui/NetworkStatusNotifier';
import { GlobalLoadingIndicator } from '@/shared/components/ui/GlobalLoadingIndicator';
import { applyTheme, getStoredTheme } from '@/shared/utils/theme';

// Apply theme before first paint to avoid flash
applyTheme(getStoredTheme());

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const content = (
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <NetworkStatusNotifier />
          <GlobalLoadingIndicator />
          {children}
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  );

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return content;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{content}</GoogleOAuthProvider>;
}
