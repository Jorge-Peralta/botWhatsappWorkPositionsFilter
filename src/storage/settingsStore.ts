import { getDb } from './db.js';
import {
  SPANISH_ROLE_KEYWORDS,
  ENGLISH_ROLE_KEYWORDS,
  SKILL_KEYWORDS,
  CASE_SENSITIVE_ACRONYMS,
} from '../extraction/keywords.js';

export interface SettingsRow {
  profile: string;
  threshold: number;
  keywordsEs: string[];
  keywordsEn: string[];
  skillKeywords: string[];
  acronyms: string[];
}

interface SettingsDbRow {
  id: number;
  profile: string;
  threshold: number;
  keywords_es: string;
  keywords_en: string;
  tech_keywords: string;
  acronyms: string;
  updated_at: string;
}

// Seed values for a fresh install — the historical hardcoded constants from
// prompt.ts (profile text, verbatim) and keywords.ts (the four arrays, which
// remain the single source of truth for these literals).
export const DEFAULT_SETTINGS: SettingsRow = {
  profile: `- Fullstack developer: C#/.NET, React/TypeScript
- Comfortable with AI tooling (Claude, DeepSeek) and dev automation
- Location: Tegucigalpa, Honduras (prioritize local/remote-friendly roles)
- Actively job hunting — false negatives (missing a good match) are worse than false
  positives (an extra notification to dismiss)`,
  threshold: 60,
  keywordsEs: SPANISH_ROLE_KEYWORDS,
  keywordsEn: ENGLISH_ROLE_KEYWORDS,
  skillKeywords: SKILL_KEYWORDS,
  acronyms: CASE_SENSITIVE_ACRONYMS,
};

function mapRow(row: SettingsDbRow): SettingsRow {
  return {
    profile: row.profile,
    threshold: row.threshold,
    keywordsEs: JSON.parse(row.keywords_es) as string[],
    keywordsEn: JSON.parse(row.keywords_en) as string[],
    skillKeywords: JSON.parse(row.tech_keywords) as string[],
    acronyms: JSON.parse(row.acronyms) as string[],
  };
}

export function getSettings(): SettingsRow {
  const db = getDb();
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsDbRow | undefined;
  if (!row) {
    throw new Error('settings row not found — initDb() should have seeded it via seedSettingsIfEmpty()');
  }
  return mapRow(row);
}

/**
 * Merges `patch` onto the current settings row and persists it. Called fresh
 * per scoring/filtering request site (no caching layer) so edits made from
 * the dashboard apply live without restarting the bot process.
 */
export function updateSettings(patch: Partial<SettingsRow>): SettingsRow {
  const merged: SettingsRow = { ...getSettings(), ...patch };
  const db = getDb();

  db.prepare(
    `UPDATE settings
     SET profile = ?, threshold = ?, keywords_es = ?, keywords_en = ?, tech_keywords = ?, acronyms = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = 1`,
  ).run(
    merged.profile,
    merged.threshold,
    JSON.stringify(merged.keywordsEs),
    JSON.stringify(merged.keywordsEn),
    JSON.stringify(merged.skillKeywords),
    JSON.stringify(merged.acronyms),
  );

  return getSettings();
}
