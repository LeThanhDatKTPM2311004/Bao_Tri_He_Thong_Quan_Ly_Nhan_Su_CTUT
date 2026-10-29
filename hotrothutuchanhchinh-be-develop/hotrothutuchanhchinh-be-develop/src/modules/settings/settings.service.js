import mongoose from 'mongoose';
import config from '../../config/index.js';
import { getAdminPortalUrl, getClientUrls, getStudentPortalUrl } from '../../config/clientUrls.js';

const maskEmail = (value = '') => {
  const email = String(value || '').trim();
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
};

const getEmailStatus = () => {
  const brevoConfigured = Boolean(config.brevo.apiKey);
  const smtpConfigured = Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

  if (brevoConfigured) {
    return {
      configured: true,
      provider: 'brevo',
      from: maskEmail(config.brevo.senderEmail || config.smtp.from || config.smtp.user),
      label: 'Brevo HTTP API',
    };
  }

  if (smtpConfigured) {
    return {
      configured: true,
      provider: 'smtp',
      from: maskEmail(config.smtp.from || config.smtp.user),
      label: `SMTP (${config.smtp.host || 'custom'})`,
    };
  }

  return {
    configured: false,
    provider: 'none',
    from: '',
    label: 'Chưa cấu hình',
  };
};

const getMongoStatus = () => {
  const state = mongoose.connection.readyState;
  const connected = state === 1;
  let host = '';
  try {
    host = mongoose.connection.host || '';
  } catch {
    host = '';
  }

  return {
    connected,
    readyState: state,
    host: connected ? host : '',
    label: connected ? 'Đã kết nối' : 'Mất kết nối',
  };
};

export const getOverview = async () => {
  const email = getEmailStatus();
  const googleConfigured = Boolean(config.google.clientId);
  const cloudinaryConfigured = Boolean(
    config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret,
  );
  const caConfigured = Boolean(
    (config.smartCa?.clientId && config.smartCa?.clientSecret) ||
      (config.ca.apiUrl && config.ca.apiKey),
  );

  return {
    system: {
      status: 'ok',
      version: process.env.RENDER_GIT_COMMIT?.slice(0, 7) || 'local',
      nodeEnv: config.nodeEnv,
      serverTime: new Date().toISOString(),
    },
    database: getMongoStatus(),
    portals: {
      adminPortalUrl: getAdminPortalUrl(),
      studentPortalUrl: getStudentPortalUrl(),
      clientUrls: getClientUrls(),
    },
    integrations: {
      email,
      google: {
        configured: googleConfigured,
        label: googleConfigured ? 'Đã cấu hình Client ID' : 'Chưa cấu hình',
      },
      cloudinary: {
        configured: cloudinaryConfigured,
        cloudName: cloudinaryConfigured ? config.cloudinary.cloudName : '',
        label: cloudinaryConfigured ? 'Đã cấu hình' : 'Chưa cấu hình',
      },
      ca: {
        configured: caConfigured,
        mode: caConfigured ? 'live' : 'mock',
        provider: caConfigured ? 'VNPT SmartCA' : '',
        label: caConfigured ? 'VNPT SmartCA (live)' : 'Mock (chưa cấu hình SMARTCA_*)',
      },
    },
    upload: {
      maxFileSize: config.upload.maxFileSize,
      maxFileSizeMb: Math.round((config.upload.maxFileSize / (1024 * 1024)) * 10) / 10,
    },
  };
};
