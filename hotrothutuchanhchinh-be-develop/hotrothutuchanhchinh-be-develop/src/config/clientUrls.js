import config from './index.js';

const normalizeClientUrl = (raw) => {
  let url = String(raw || '').trim();
  // Render env đôi khi bị dán nhầm: CLIENT_URL=https://...
  url = url.replace(/^CLIENT_URL\s*=\s*/i, '');
  return url.trim();
};

const pickPortalUrl = (urls, matchers, fallback) => {
  for (const matcher of matchers) {
    const matched = urls.find((url) => matcher.test(url));
    if (matched) return matched;
  }
  return fallback;
};

export const getClientUrls = () =>
  config.clientUrls.map(normalizeClientUrl).filter((url) => /^https?:\/\//i.test(url));

export const getAdminPortalUrl = () => {
  const explicit = (process.env.ADMIN_PORTAL_URL || '').trim().replace(/^CLIENT_URL\s*=\s*/i, '');
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/$/, '');

  const urls = getClientUrls();
  return pickPortalUrl(
    urls,
    [/hotrothutuchanhchinh-admin/i, /:5174\b/i, /admin/i],
    urls[0] || 'http://localhost:5174',
  );
};

export const getStudentPortalUrl = () => {
  const explicit = (process.env.STUDENT_PORTAL_URL || '').trim().replace(/^CLIENT_URL\s*=\s*/i, '');
  if (explicit && /^https?:\/\//i.test(explicit)) return explicit.replace(/\/$/, '');
  const urls = getClientUrls();
  return pickPortalUrl(
    urls,
    [/hotrothutuchanhchinh-fe/i, /:5173\b/i, /student/i],
    urls.find((url) => !/admin|5174/i.test(url)) || urls[0] || 'http://localhost:5173',
  );
};
