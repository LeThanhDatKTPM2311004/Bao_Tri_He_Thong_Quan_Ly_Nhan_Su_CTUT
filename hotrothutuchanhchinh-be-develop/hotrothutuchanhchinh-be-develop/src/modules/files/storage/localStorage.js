import fs from 'fs/promises';
import path from 'path';
import config from '../../../config/index.js';

export const saveFile = async (file, subDir = 'submissions') => {
  const uploadPath = path.join(config.upload.dir, subDir);
  await fs.mkdir(uploadPath, { recursive: true });
  return path.join(uploadPath, file.filename);
};

export const deleteFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist
  }
};
