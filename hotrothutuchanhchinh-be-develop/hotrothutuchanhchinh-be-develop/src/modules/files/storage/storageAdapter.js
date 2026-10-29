import * as localStorage from './localStorage.js';

export const storageAdapter = {
  save: localStorage.saveFile,
  delete: localStorage.deleteFile,
};

export default storageAdapter;
