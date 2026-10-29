import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { useScratchDb } from '../testSupport/scratchDb.js';

const dbPath = useScratchDb();

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
  assert.equal(settings.keywordFilterEnabled, true);
  assert.equal(settings.candidateGender, 'unspecified');
});

test('updateSettings persists the candidate gender', () => {
  store.updateSettings({ candidateGender: 'female' });
  assert.equal(store.getSettings().candidateGender, 'female');
});

test('updateSettings persists the keyword filter toggle', () => {
  store.updateSettings({ keywordFilterEnabled: false });
  assert.equal(store.getSettings().keywordFilterEnabled, false);

  store.updateSettings({ keywordFilterEnabled: true });
  assert.equal(store.getSettings().keywordFilterEnabled, true);
});

test('updateSettings persists country and language', () => {
  store.updateSettings({ country: 'Costa Rica', language: 'English' });
  const settings = store.getSettings();

  assert.equal(settings.country, 'Costa Rica');
  assert.equal(settings.language, 'English');
  assert.equal(settings.profile, 'legacy profile');
});
