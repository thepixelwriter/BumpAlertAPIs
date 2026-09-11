import { createApp } from './app';
import { env } from './config/env';
async function main(): Promise<void> {
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`BumpAlert server: listening on port ${env.port}`);
  });
}

main().catch((error) => {
  console.error('BumpAlert server: failed to start', error);
  process.exit(1);
});
