import 'dotenv/config';
import { verifySmtpConnection, sendPasswordResetEmail, isSmtpConfigured } from '../shared/services/emailService.js';

const to = process.argv[2];

async function main() {
  if (!isSmtpConfigured()) {
    console.error('\n❌ SMTP chưa cấu hình trong server/.env\n');
    console.error('Cần điền:');
    console.error('  SMTP_HOST=smtp.gmail.com');
    console.error('  SMTP_PORT=587');
    console.error('  SMTP_USER=your@gmail.com');
    console.error('  SMTP_PASS=xxxx xxxx xxxx xxxx  (App Password, bỏ dấu cách)');
    console.error('  EMAIL_FROM=your@gmail.com\n');
    process.exit(1);
  }

  console.log('Đang kiểm tra kết nối Gmail SMTP...');
  await verifySmtpConnection();
  console.log('✓ Kết nối Gmail OK');

  if (!to) {
    console.log('\nDùng: npm run email:test -- email-nhan@gmail.com');
    process.exit(0);
  }

  const testUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/auth/reset-password?token=test-token`;
  await sendPasswordResetEmail({
    to,
    resetUrl: testUrl,
    fullName: 'Kiểm tra hệ thống',
  });
  console.log(`✓ Đã gửi email thử tới ${to}. Kiểm tra hộp thư Gmail (cả mục Spam).`);
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
