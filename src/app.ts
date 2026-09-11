import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { reportRouter } from './routes/report.routes';
import { swaggerRouter } from './routes/swagger.routes';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.use('/api/health', healthRouter);
  app.use('/api/swagger', swaggerRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/reports', reportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
