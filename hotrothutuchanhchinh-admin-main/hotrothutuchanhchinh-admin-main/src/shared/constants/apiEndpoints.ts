export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    GOOGLE_LOGIN: '/auth/google',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    VERIFY_RESET_TOKEN: '/auth/verify-reset-token',
    RESET_PASSWORD: '/auth/reset-password',
  },
  USERS: {
    BASE: '/users',
    ME: '/users/me',
    CHANGE_PASSWORD: '/users/me/password',
    GOOGLE_LINK: '/users/me/google/link',
  },
  FORMS: '/forms',
  IMPORT_FORMS: '/import-forms',
  SUBMISSIONS: '/forms/submissions',
  WORKFLOWS: '/workflows',
  SIGNATURES: '/signatures',
  NOTIFICATIONS: '/notifications',
  DASHBOARD: '/dashboard',
  REPORTS: '/reports',
  ORGANIZATION: '/organization',
  SETTINGS: {
    OVERVIEW: '/settings/overview',
  },
  CHATBOT: {
    ADMIN_ASK: '/chatbot/admin/ask',
    ADMIN_SUGGESTIONS: '/chatbot/admin/suggestions',
  },
} as const;
