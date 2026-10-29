export const sendInAppNotification = async (notificationService, data) => {
  return notificationService.create({ ...data, channels: ['in_app'] });
};
