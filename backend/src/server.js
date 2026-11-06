import 'dotenv/config';
import { loadConfig } from './config/env.js';
import { createApp } from './app.js';
import { printStartupSummary } from '../../startupLogger.js';

let config;
try { config = loadConfig(); }
catch (error) { console.error(`[startup] ${error.message}`); process.exit(1); }

const app = createApp(config);
const server = app.listen(config.port, () => {
  printStartupSummary(app, config);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} received`);
  server.close((error) => { if (error) { console.error(error); process.exit(1); } process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => { console.error('[unhandledRejection]', reason); });
process.on('uncaughtException', (error) => { console.error('[uncaughtException]', error); shutdown('uncaughtException'); });
