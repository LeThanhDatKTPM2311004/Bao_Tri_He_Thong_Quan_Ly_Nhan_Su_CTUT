const ACCESS_TOKEN_KEY = 'tthc_access_token';
const REFRESH_TOKEN_KEY = 'tthc_refresh_token';
const REMEMBER_KEY = 'tthc_remember_me';
const TAB_REMEMBER_KEY = 'tthc_tab_remember';

const clearPair = (storage: Storage) => {
  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Mỗi tab giữ phiên trong sessionStorage.
 * localStorage chỉ là bản ghi nhớ để tab mới mở lại được, không được đè tab đang đăng nhập.
 */
const ensureTabSession = () => {
  const ownAccess = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const ownRefresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (ownAccess || ownRefresh) return;

  const sharedAccess = localStorage.getItem(ACCESS_TOKEN_KEY);
  const sharedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!sharedAccess && !sharedRefresh) return;

  if (sharedAccess) sessionStorage.setItem(ACCESS_TOKEN_KEY, sharedAccess);
  if (sharedRefresh) sessionStorage.setItem(REFRESH_TOKEN_KEY, sharedRefresh);
  if (localStorage.getItem(REMEMBER_KEY) === 'true') {
    sessionStorage.setItem(TAB_REMEMBER_KEY, 'true');
  }
};

const tabRemembers = () => sessionStorage.getItem(TAB_REMEMBER_KEY) === 'true';

export const tokenStorage = {
  setRememberMe(remember: boolean) {
    if (remember) {
      sessionStorage.setItem(TAB_REMEMBER_KEY, 'true');
      localStorage.setItem(REMEMBER_KEY, 'true');
    } else {
      sessionStorage.removeItem(TAB_REMEMBER_KEY);
    }
  },

  isRememberMe: () => tabRemembers(),

  setTokens(accessToken: string, refreshToken: string, remember?: boolean) {
    if (remember !== undefined) {
      this.setRememberMe(remember);
    }

    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);

    const persist = remember !== undefined ? remember : tabRemembers();
    if (persist) {
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      localStorage.setItem(REMEMBER_KEY, 'true');
    }
  },

  setAccessToken(token: string) {
    ensureTabSession();
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
    if (tabRemembers()) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  },

  setRefreshToken(token: string) {
    ensureTabSession();
    sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
    if (tabRemembers()) localStorage.setItem(REFRESH_TOKEN_KEY, token);
  },

  getAccessToken() {
    ensureTabSession();
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken() {
    ensureTabSession();
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  },

  clear() {
    const refresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
    const sharedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY);
    clearPair(sessionStorage);
    sessionStorage.removeItem(TAB_REMEMBER_KEY);
    if (refresh && sharedRefresh && refresh === sharedRefresh) {
      clearPair(localStorage);
      localStorage.removeItem(REMEMBER_KEY);
    }
  },
};
