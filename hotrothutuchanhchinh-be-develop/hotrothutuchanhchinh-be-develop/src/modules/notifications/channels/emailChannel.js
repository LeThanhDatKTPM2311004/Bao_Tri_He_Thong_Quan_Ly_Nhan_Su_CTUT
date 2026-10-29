import createMailTransporter from '../../../config/nodemailer.js';
import config from '../../../config/index.js';

export const sendEmailNotification = async (notification) => {
  const transporter = createMailTransporter();
  if (!transporter) return;

  await transporter.sendMail({
    from: config.smtp.from,
    to: notification.recipientEmail,
    subject: notification.title,
    text: notification.message,
  });
};
