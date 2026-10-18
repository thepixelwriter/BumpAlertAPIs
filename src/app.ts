import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { reportRouter } from './routes/report.routes';
import { swaggerJsonRouter, swaggerRouter } from './routes/swagger.routes';

export function createApp(): express.Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false }));
  app.use(cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(','),
    credentials: true,
  }));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () => {
      const event = JSON.stringify({
        event: res.statusCode >= 400 ? 'security.api_request' : 'api.request',
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
      if (res.statusCode >= 400) {
        console.warn(event);
      } else {
        console.log(event);
      }
    });

    if (!['GET', 'HEAD', 'POST', 'PATCH', 'OPTIONS'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD, POST, PATCH, OPTIONS');
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    if (
      ['POST', 'PATCH'].includes(req.method)
      && req.path.startsWith('/api/')
      && !/^application\/(?:[a-z0-9.+-]+\+)?json(?:\s*;|$)/i.test(req.get('content-type') ?? '')
    ) {
      res.status(415).json({ error: 'Content-Type must be application/json' });
      return;
    }

    next();
  });
  app.use(express.json({ limit: '64kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/swagger', swaggerRouter);
  app.use('/api/swagger.json', swaggerJsonRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/reports', reportRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
