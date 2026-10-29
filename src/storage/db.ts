import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { DEFAULT_SETTINGS } from './settingsStore.js';

const log = logger.child({ module: 'db' });

const DDL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS jobs (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_jid                 TEXT NOT NULL,
  sender                    TEXT,
  message_id                TEXT,
  message_timestamp         INTEGER,
  image_path                TEXT NOT NULL,
  metadata_path              TEXT NOT NULL,
  image_hash                 TEXT NOT NULL,
  duplicate_of_id            INTEGER REFERENCES jobs(id),
  caption                    TEXT,
  ocr_text                   TEXT,
  ocr_confidence              REAL,
  ocr_has_keyword             INTEGER NOT NULL DEFAULT 0,
  extracted_json               TEXT,
  extraction_skipped_reason     TEXT,
  keyword_match                 INTEGER,
  matched_keyword                TEXT,
  discard_reason                  TEXT CHECK (discard_reason IN ('duplicate','non_it') OR discard_reason IS NULL),
  relevance_score                  REAL,
  relevance_reasoning               TEXT,
  relevance_skipped_reason           TEXT,
  notified_at                         TEXT,
  status                            TEXT NOT NULL DEFAULT 'new'
                                        CHECK (status IN ('new','reviewed','applied','discarded')),
  created_at                         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_jobs_group_jid  ON jobs(group_jid);
CREATE INDEX IF NOT EXISTS idx_jobs_status     ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_image_hash ON jobs(image_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_message_id
  ON jobs(message_id) WHERE message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS settings (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  profile        TEXT NOT NULL,
  threshold      REAL NOT NULL,
  keywords_es    TEXT NOT NULL,  -- JSON array
  keywords_en    TEXT NOT NULL,  -- JSON array
  tech_keywords  TEXT NOT NULL,  -- JSON array
  acronyms       TEXT NOT NULL,  -- JSON array
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
`;

let db: DatabaseSync | null = null;

// Phase 4 added columns to an already-shipped `jobs` table. CREATE TABLE IF
// NOT EXISTS won't retrofit columns onto an existing table, so new columns
// need an explicit, idempotent ALTER TABLE migration on top of the DDL.
const JOBS_TABLE_MIGRATIONS: { column: string; ddl: string }[] = [
  { column: 'relevance_reasoning', ddl: 'ALTER TABLE jobs ADD COLUMN relevance_reasoning TEXT' },
  { column: 'relevance_skipped_reason', ddl: 'ALTER TABLE jobs ADD COLUMN relevance_skipped_reason TEXT' },
  { column: 'notified_at', ddl: 'ALTER TABLE jobs ADD COLUMN notified_at TEXT' },
];

function migrateJobsTable(db: DatabaseSync): void {
  const existingColumns = new Set(
    (db.prepare('PRAGMA table_info(jobs)').all() as { name: string }[]).map((row) => row.name),
  );
  for (const migration of JOBS_TABLE_MIGRATIONS) {
    if (!existingColumns.has(migration.column)) {
      db.exec(migration.ddl);
      log.info({ column: migration.column }, 'applied jobs table migration');
    }
  }
}

/**
 * Seeds the single settings row with the historical hardcoded defaults on
 * first run, so an existing install doesn't wake up to a blank settings
 * screen. No-op once the row exists.
 */
function seedSettingsIfEmpty(db: DatabaseSync): void {
  const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (existing) return;

  db.prepare(
    `INSERT INTO settings (id, profile, threshold, keywords_es, keywords_en, tech_keywords, acronyms)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
  ).run(
    DEFAULT_SETTINGS.profile,
    DEFAULT_SETTINGS.threshold,
    JSON.stringify(DEFAULT_SETTINGS.keywordsEs),
    JSON.stringify(DEFAULT_SETTINGS.keywordsEn),
    JSON.stringify(DEFAULT_SETTINGS.skillKeywords),
    JSON.stringify(DEFAULT_SETTINGS.acronyms),
  );
  log.info('seeded default settings row');
}

/**
 * Opens (creating if needed) the SQLite database and applies the DDL above.
 * Idempotent — safe to call once at startup; CREATE TABLE/INDEX use
 * IF NOT EXISTS so re-running against an existing database is a no-op.
 */
export function initDb(): void {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

  db = new DatabaseSync(config.dbPath);
  db.exec(DDL);
  migrateJobsTable(db);
  seedSettingsIfEmpty(db);

  log.info({ dbPath: config.dbPath }, 'initialized jobs database');
}

export function getDb(): DatabaseSync {
  if (!db) {
    throw new Error('db not initialized — call initDb() before getDb()');
  }
  return db;
}
