import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import config from './config/index.js';
import { startOverdueScanner } from './modules/workflows/workflowOverdue.service.js';

const ensureUploadDirs = () => {
  const base = path.resolve(config.upload.dir);
  for (const sub of ['', 'submissions', 'signatures', 'temp']) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
};

const startServer = async () => {
  try {
    ensureUploadDirs();

    const app = createApp();
    const PORT = config.port;
    // Listen trước khi chờ Mongo — Render free health-check dễ timeout nếu bind muộn.
    const onListening = () => {
      console.log(`[Server] Running on port ${PORT} (${config.nodeEnv})`);
      console.log(`[Server] API: http://localhost:${PORT}/api/v1`);
    };

    if (config.ssl?.keyPath && config.ssl?.certPath) {
      const options = {
        key: fs.readFileSync(config.ssl.keyPath),
        cert: fs.readFileSync(config.ssl.certPath),
      };
      https.createServer(options, app).listen(PORT, '0.0.0.0', onListening);
    } else {
      app.listen(PORT, '0.0.0.0', onListening);
    }

    await connectDatabase();
    startOverdueScanner();

    const { warmLibreOffice } = await import(
      './modules/convertFileAndSubmit/pdfConvert.js'
    );
    warmLibreOffice();
  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
};

startServer();
