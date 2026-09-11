import { createServer } from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import { createApp } from './app';
import { connectDatabase, type D1DatabaseLike } from './db/sqlite';

const app = createApp();
const server = createServer(app);
server.listen(3000);

const handleRequest = httpServerHandler({ port: 3000 });

export default {
  async fetch(request: Request, env: { DB: D1DatabaseLike }, context: unknown): Promise<Response> {
    await connectDatabase(env.DB);
    return handleRequest(request, env, context);
  },
};