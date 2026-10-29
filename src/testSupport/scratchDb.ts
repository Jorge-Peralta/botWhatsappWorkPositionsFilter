import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Points config at a fresh scratch database under the OS temp dir. config.ts
 * resolves these paths at import time, so call this before (dynamically)
 * importing anything that pulls config in. Returns the database path.
 */
export function useScratchDb(): string {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-test-'));
  const dbPath = path.join(scratchDir, 'jobs.db');
  process.env.DB_PATH = dbPath;
  process.env.IMAGES_DIR = path.join(scratchDir, 'images');
  process.env.SESSION_DIR = path.join(scratchDir, 'auth');
  return dbPath;
}
