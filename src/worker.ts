import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app';
import { connectDatabase, type D1DatabaseLike } from './db/sqlite';
import { enforceRequestRateLimits, type RateLimitBinding } from './middleware/request-rate-limit';

const app = createApp();
const server = createServer(app);
server.listen(3000);

const handleRequest = httpServerHandler({ port: 3000 });

interface WorkerEnv {
  DB: D1DatabaseLike;
  RESEND_API_KEY: string;
  RESET_URL: string;
  EMAIL_FROM: string;
  EMAIL_FROM_NAME: string;
  API_RATE_LIMITER: RateLimitBinding;
  AUTH_RATE_LIMITER: RateLimitBinding;
}

export default {
  async fetch(request: Request, env: WorkerEnv, context: unknown): Promise<Response> {
    const limited = await enforceRequestRateLimits(request, env);
    if (limited) {
      return limited;
    }

    await connectDatabase(env.DB);
    app.locals.resendApiKey = env.RESEND_API_KEY;
    app.locals.resetUrl = env.RESET_URL;
    app.locals.emailFrom = env.EMAIL_FROM;
    app.locals.emailFromName = env.EMAIL_FROM_NAME;
    return handleRequest.fetch(request, env, context);
  },
};