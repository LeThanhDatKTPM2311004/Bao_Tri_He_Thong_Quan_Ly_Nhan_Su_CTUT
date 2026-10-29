export default {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    sessionRefreshExpiresIn: process.env.JWT_SESSION_REFRESH_EXPIRES_IN || '8h',
  },
  clientUrls: (() => {
    const raw = (process.env.CLIENT_URL || 'http://localhost:5173').trim();
    const withoutKeyPrefix = raw.replace(/^CLIENT_URL\s*=\s*/i, '');
    const urls = withoutKeyPrefix
      .split(',')
      .map((url) => url.trim().replace(/^CLIENT_URL\s*=\s*/i, ''))
      .filter(Boolean);
    return urls.length > 0 ? urls : ['http://localhost:5173'];
  })(),
  get clientUrl() {
    return this.clientUrls[0];
  },
  corsAllowVercelPreviews: process.env.CORS_ALLOW_VERCEL_PREVIEWS === 'true',
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760,
  },
  smtp: {
    host: (process.env.SMTP_HOST || '').trim(),
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: (process.env.SMTP_USER || '').trim(),
    pass: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
    from: (process.env.EMAIL_FROM || '').trim(),
  },
  brevo: {
    apiKey: (process.env.BREVO_API_KEY || '').trim(),
    senderEmail: (process.env.BREVO_SENDER_EMAIL || '').trim(),
  },
  google: {
    clientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  },
  ca: {
    // Legacy aliases — ưu tiên SMARTCA_* bên dưới
    apiUrl: process.env.CA_API_URL || process.env.SMARTCA_API_BASE || '',
    apiKey: process.env.CA_API_KEY || process.env.SMARTCA_CLIENT_SECRET || '',
  },
  smartCa: {
    /** Production: https://gwsca.vnpt.vn/sca/sp769 — UAT: https://rmgateway.vnptit.vn/sca/sp769 */
    apiBase: (
      process.env.SMARTCA_API_BASE ||
      process.env.CA_API_URL ||
      'https://gwsca.vnpt.vn/sca/sp769'
    ).trim(),
    clientId: (process.env.SMARTCA_CLIENT_ID || '').trim(),
    clientSecret: (process.env.SMARTCA_CLIENT_SECRET || process.env.CA_API_KEY || '').trim(),
    mobileCode: (process.env.SMARTCA_MOBILE_CODE || '').trim(),
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
  log: {
    dir: process.env.LOG_DIR || './logs',
    level: process.env.LOG_LEVEL || 'info',
  },
  ssl: {
    keyPath: process.env.SSL_KEY_PATH,
    certPath: process.env.SSL_CERT_PATH,
  },
};
