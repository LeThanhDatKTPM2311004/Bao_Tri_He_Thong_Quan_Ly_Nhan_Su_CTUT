import nodemailer from 'nodemailer';
import config from '../../config/index.js';

let transporter = null;

// Render free tier chặn cổng SMTP 25/465/587 → dùng HTTP API (443) khi có BREVO_API_KEY
const isBrevoConfigured = () => Boolean(config.brevo.apiKey);

export const isSmtpConfigured = () =>
  Boolean(config.smtp.host && config.smtp.user && config.smtp.pass);

export const isEmailConfigured = () => isBrevoConfigured() || isSmtpConfigured();

const sendViaBrevo = async ({ to, subject, html, text }) => {
  const senderEmail = config.brevo.senderEmail || config.smtp.from || config.smtp.user;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.brevo.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'CTUT e-Portal', email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      headers: {
        'X-Mailin-Track': '0',
        'X-Mailin-Track-Clicks': '0',
        'X-Mailin-Track-Opens': '0',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Brevo API ${response.status}: ${body.slice(0, 300)}`);
  }
};

const deliverEmail = async ({ to, subject, html, text }) => {
  if (isBrevoConfigured()) {
    await sendViaBrevo({ to, subject, html, text });
    return;
  }

  // Render free tier chặn cổng SMTP — không thử Gmail trên production (tránh treo 2 phút)
  if (config.nodeEnv === 'production') {
    throw new Error(
      'Chưa cấu hình BREVO_API_KEY trên Render. Render free tier không gửi được qua Gmail SMTP.',
    );
  }

  const from = config.smtp.from || config.smtp.user;
  const transport = getMailTransporter();
  await transport.sendMail({
    from: `"CTUT e-Portal" <${from}>`,
    to,
    subject,
    html,
    text,
  });
};

// Fail nhanh thay vì treo request 2 phút khi cổng SMTP bị chặn
const SMTP_TIMEOUTS = {
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
};

const createTransporter = () => {
  const { host, port, user, pass } = config.smtp;

  if (host === 'smtp.gmail.com' || user?.endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
      ...SMTP_TIMEOUTS,
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: { user, pass },
    ...SMTP_TIMEOUTS,
  });
};

export const getMailTransporter = () => {
  if (!isSmtpConfigured()) return null;
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

export const verifySmtpConnection = async () => {
  const transport = getMailTransporter();
  if (!transport) {
    throw new Error('SMTP chưa cấu hình. Cập nhật SMTP_USER và SMTP_PASS trong server/.env');
  }
  await transport.verify();
};

export const sendPasswordResetEmail = async ({ to, resetUrl, fullName }) => {
  const mailOptions = {
    to,
    subject: '[CTUT e-Portal] Đặt lại mật khẩu',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Đặt lại mật khẩu</h2>
        <p>Xin chào <strong>${fullName}</strong>,</p>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản CTUT e-Portal.</p>
        <p><a href=${resetUrl} style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">Đặt lại mật khẩu</a></p>
        <p style="margin-top:16px;">Nếu nút trên không mở được, hãy sao chép liên kết này vào trình duyệt:</p>
        <p style="word-break:break-all;"><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Liên kết có hiệu lực trong <strong>30 phút</strong>. Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>
        <p style="color:#64748b;font-size:12px;">CTUT e-Portal — Hệ thống Thủ tục Hành chính Điện tử</p>
      </div>
    `,
    text: `Xin chào ${fullName},

Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản CTUT e-Portal.

Mở liên kết sau để đặt lại mật khẩu:
${resetUrl}

Liên kết có hiệu lực trong 30 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
  };

  if (!isEmailConfigured()) {
    throw new Error(
      'Chưa cấu hình email. Điền BREVO_API_KEY hoặc SMTP_USER + SMTP_PASS (App Password) trong env.',
    );
  }

  try {
    await deliverEmail(mailOptions);
    console.log(`[Email] Đã gửi link đặt lại mật khẩu → ${to}`);
    return { sent: true };
  } catch (error) {
    console.error('[Email] Gửi email thất bại:', error.message);
    throw new Error(
      'Không gửi được email. Kiểm tra BREVO_API_KEY hoặc SMTP_USER/SMTP_PASS trong env (Render free tier chặn cổng SMTP).',
    );
  }
};

const buildWorkflowEmailHtml = ({ heading, paragraphs = [], details = [], actionUrl, actionLabel }) => {
  const detailRows = details
    .filter((item) => item?.value)
    .map(
      (item) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;white-space:nowrap;">${item.label}</td><td style="padding:6px 0;font-weight:600;">${item.value}</td></tr>`,
    )
    .join('');

  const body = paragraphs.map((text) => `<p style="margin:0 0 12px;line-height:1.6;">${text}</p>`).join('');
  const actionButton = actionUrl
    ? `<p style="margin:24px 0 0;"><a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">${actionLabel || 'Mở hệ thống'}</a></p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#2563eb;margin:0 0 16px;">${heading}</h2>
      ${body}
      ${
        detailRows
          ? `<table style="margin:16px 0 0;border-collapse:collapse;">${detailRows}</table>`
          : ''
      }
      ${actionButton}
      <p style="color:#64748b;font-size:12px;margin-top:24px;">CTUT e-Portal — Hệ thống Thủ tục Hành chính Điện tử</p>
    </div>
  `;
};

export const sendWorkflowEmail = async ({ to, subject, heading, paragraphs, details, actionUrl, actionLabel }) => {
  if (!to) return { sent: false, reason: 'missing_recipient' };

  const html = buildWorkflowEmailHtml({ heading, paragraphs, details, actionUrl, actionLabel });

  if (!isEmailConfigured()) {
    console.warn(`[Email] Email chưa cấu hình, bỏ qua gửi workflow email → ${to}`);
    return { sent: false, reason: 'email_not_configured' };
  }

  try {
    await deliverEmail({ to, subject, html });
    console.log(`[Email] Đã gửi thông báo quy trình → ${to}`);
    return { sent: true };
  } catch (error) {
    console.error(`[Email] Gửi thông báo quy trình thất bại (${to}):`, error.message);
    return { sent: false, reason: error.message };
  }
};
