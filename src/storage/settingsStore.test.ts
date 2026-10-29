import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// config.ts resolves DB_PATH at import time, so point it at a scratch
// database before importing anything that pulls config in.
const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
const dbPath = path.join(scratchDir, 'jobs.db');
process.env.DB_PATH = dbPath;
process.env.IMAGES_DIR = path.join(scratchDir, 'images');
process.env.SESSION_DIR = path.join(scratchDir, 'auth');

// A settings table as shipped before country/language existed.
function createLegacySettingsTable(): void {
  const legacy = new DatabaseSync(dbPath);
  legacy.exec(`CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    profile TEXT NOT NULL, threshold REAL NOT NULL,
    keywords_es TEXT NOT NULL, keywords_en TEXT NOT NULL,
    tech_keywords TEXT NOT NULL, acronyms TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  legacy
    .prepare('INSERT INTO settings VALUES (1, ?, 70, ?, ?, ?, ?, ?)')
    .run('legacy profile', '["contador"]', '["accountant"]', '["excel"]', '[]', '2026-01-01T00:00:00.000Z');
  legacy.close();
}

let store: typeof import('./settingsStore.js');

before(async () => {
  createLegacySettingsTable();
  const { initDb } = await import('./db.js');
  initDb();
  store = await import('./settingsStore.js');
});

test('existing settings row gains default country/language and keeps its data', () => {
  const settings = store.getSettings();

  assert.equal(settings.profile, 'legacy profile');
  assert.equal(settings.threshold, 70);
  assert.deepEqual(settings.skillKeywords, ['excel']);
  assert.equal(settings.country, 'Honduras');
  assert.equal(settings.language, 'Spanish');
});

test('updateSettings persists country and language', () => {
  store.updateSettings({ country: 'Costa Rica', language: 'English' });
  const settings = store.getSettings();

  assert.equal(settings.country, 'Costa Rica');
  assert.equal(settings.language, 'English');
  assert.equal(settings.profile, 'legacy profile');
});
