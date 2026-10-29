import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import routes from './routes/index.js';
import { errorHandler } from './shared/middlewares/errorHandler.js';
import { requestLogger } from './shared/middlewares/requestLogger.js';

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (config.clientUrls.includes(origin)) return true;
  if (config.corsAllowVercelPreviews) {
    try {
      return new URL(origin).hostname.endsWith('.vercel.app');
    } catch {
      return false;
    }
  }
  return false;
};

export const createApp = () => {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) callback(null, true);
        else callback(new Error(`CORS blocked: ${origin}`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/api/v1', routes);

  app.use(errorHandler);

  return app;
};
