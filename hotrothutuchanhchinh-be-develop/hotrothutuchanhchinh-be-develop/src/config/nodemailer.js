import nodemailer from 'nodemailer';
import config from './index.js';

export const createMailTransporter = () => {
  if (!config.smtp.host) {
    console.warn('[Email] SMTP not configured');
    return null;
  }

  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
};

export default createMailTransporter;
