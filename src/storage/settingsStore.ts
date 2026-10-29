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
  country: string;
  language: string;
  // When false, the keyword lists stop gating flyers: every flyer is sent to
  // vision extraction and relevance scoring (more API calls, no keyword misses).
  keywordFilterEnabled: boolean;
  // Only set by the candidate themselves (never inferred from a CV); lets the
  // scorer penalize flyers that explicitly require a different gender.
  candidateGender: CandidateGender;
}

export const CANDIDATE_GENDERS = ['unspecified', 'female', 'male'] as const;
export type CandidateGender = (typeof CANDIDATE_GENDERS)[number];

// Where the monitored groups post from — used to hint the flyer language and
// location to the extraction and relevance prompts. Blank values omit the hint.
export type JobRegion = Pick<SettingsRow, 'country' | 'language'>;

interface SettingsDbRow {
  id: number;
  profile: string;
  threshold: number;
  keywords_es: string;
  keywords_en: string;
  tech_keywords: string;
  acronyms: string;
  country: string;
  language: string;
  keyword_filter_enabled: number;
  candidate_gender: string;
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
  country: 'Honduras',
  language: 'Spanish',
  keywordFilterEnabled: true,
  candidateGender: 'unspecified',
};

function toCandidateGender(value: string): CandidateGender {
  return (CANDIDATE_GENDERS as readonly string[]).includes(value) ? (value as CandidateGender) : 'unspecified';
}

function mapRow(row: SettingsDbRow): SettingsRow {
  return {
    profile: row.profile,
    threshold: row.threshold,
    keywordsEs: JSON.parse(row.keywords_es) as string[],
    keywordsEn: JSON.parse(row.keywords_en) as string[],
    skillKeywords: JSON.parse(row.tech_keywords) as string[],
    acronyms: JSON.parse(row.acronyms) as string[],
    country: row.country,
    language: row.language,
    keywordFilterEnabled: row.keyword_filter_enabled === 1,
    candidateGender: toCandidateGender(row.candidate_gender),
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
         country = ?, language = ?, keyword_filter_enabled = ?,
         candidate_gender = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = 1`,
  ).run(
    merged.profile,
    merged.threshold,
    JSON.stringify(merged.keywordsEs),
    JSON.stringify(merged.keywordsEn),
    JSON.stringify(merged.skillKeywords),
    JSON.stringify(merged.acronyms),
    merged.country,
    merged.language,
    merged.keywordFilterEnabled ? 1 : 0,
    merged.candidateGender,
  );

  return getSettings();
}
