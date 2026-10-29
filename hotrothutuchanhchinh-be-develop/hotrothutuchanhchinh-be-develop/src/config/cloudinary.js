import { v2 as cloudinary } from 'cloudinary';
import config from './index.js';

export const isCloudinaryConfigured = () =>
  Boolean(
    config.cloudinary.cloudName &&
      config.cloudinary.apiKey &&
      config.cloudinary.apiSecret,
  );

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
  });
}

export { cloudinary };
export default cloudinary;
