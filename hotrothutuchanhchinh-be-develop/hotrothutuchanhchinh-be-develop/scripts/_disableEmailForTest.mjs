// Import đầu tiên trong script test để tắt gửi email thật (tránh spam tài khoản thật).
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.BREVO_API_KEY;
