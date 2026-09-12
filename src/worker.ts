import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app';
import { connectDatabase, type D1DatabaseLike } from './db/sqlite';

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
}

export default {
  async fetch(request: Request, env: WorkerEnv, context: unknown): Promise<Response> {
    await connectDatabase(env.DB);
    app.locals.resendApiKey = env.RESEND_API_KEY;
    app.locals.resetUrl = env.RESET_URL;
    app.locals.emailFrom = env.EMAIL_FROM;
    app.locals.emailFromName = env.EMAIL_FROM_NAME;
    return handleRequest.fetch(request, env, context);
  },
};