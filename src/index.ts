import 'dotenv/config';
import { logger } from './logger.js';
import { initDb } from './storage/db.js';
import { startConnection } from './whatsapp/connection.js';

const log = logger.child({ module: 'index' });

process.on('unhandledRejection', (reason) => {
  log.error({ reason }, 'unhandled promise rejection');
});

// Fail fast: if the jobs database can't be initialized, nothing downstream
// of image capture (dedup, persistence) will work.
initDb();

startConnection().catch((err) => {
  log.error({ err }, 'failed to start WhatsApp connection');
  process.exit(1);
});
