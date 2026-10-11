import mongoose from 'mongoose';
import { env } from './config/env.js';
import { createApp } from './app.js';

async function main() {
  mongoose.set('autoIndex', false);
  await mongoose.connect(env.MONGODB_URI);
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.info(JSON.stringify({ level: 'info', event: 'server_started', port: env.PORT, nodeEnv: env.NODE_ENV }));
  });
  const shutdown = async (signal: string) => {
    console.info(JSON.stringify({ level: 'info', event: 'shutdown_started', signal }));
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch(error => {
  console.error(JSON.stringify({ level: 'fatal', event: 'startup_failed', name: error instanceof Error ? error.name : 'UnknownError' }));
  process.exit(1);
});
