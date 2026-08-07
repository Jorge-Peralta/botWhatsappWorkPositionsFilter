import fs from 'node:fs';
import path from 'node:path';

export interface Config {
  sessionDir: string;
  imagesDir: string;
  groupsFilePath: string;
  targetGroupJids: Set<string>;
  logLevel: string;
  usePairingCode: boolean;
  pairingPhoneNumber: string | undefined;
  anthropicApiKey: string | undefined;
  extractionModel: string;
  extractionFallbackModel: string;
  maxImageLongEdge: number;
  extractionProvider: 'gemini' | 'anthropic';
  geminiApiKey: string | undefined;
  geminiModel: string;
  dbPath: string;
  dashboardPort: number;
}

function resolvePath(value: string | undefined, fallback: string): string {
  const raw = value && value.trim().length > 0 ? value.trim() : fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
}

function parseTargetGroupJids(value: string | undefined): Set<string> {
  if (!value) return new Set();
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  );
}

function parseBoolean(value: string | undefined): boolean {
  return (value ?? '').trim().toLowerCase() === 'true';
}

const sessionDir = resolvePath(process.env.SESSION_DIR, './data/auth');
const imagesDir = resolvePath(process.env.IMAGES_DIR, './data/images');
const groupsFilePath = resolvePath(process.env.GROUPS_FILE_PATH, './data/groups.json');
const dbPath = resolvePath(process.env.DB_PATH, './data/jobs.db');

// Fail fast: if we can't create the data directories, nothing else will work.
fs.mkdirSync(sessionDir, { recursive: true });
fs.mkdirSync(imagesDir, { recursive: true });
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const config: Config = {
  sessionDir,
  imagesDir,
  groupsFilePath,
  targetGroupJids: parseTargetGroupJids(process.env.TARGET_GROUP_JIDS),
  logLevel: process.env.LOG_LEVEL?.trim() || 'info',
  usePairingCode: parseBoolean(process.env.USE_PAIRING_CODE),
  pairingPhoneNumber: process.env.PAIRING_PHONE_NUMBER?.trim() || undefined,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
  extractionModel: process.env.EXTRACTION_MODEL?.trim() || 'claude-haiku-4-5',
  extractionFallbackModel: process.env.EXTRACTION_FALLBACK_MODEL?.trim() || 'claude-sonnet-5',
  maxImageLongEdge: Number(process.env.MAX_IMAGE_LONG_EDGE) || 1568,
  extractionProvider:
    process.env.EXTRACTION_PROVIDER?.trim().toLowerCase() === 'anthropic' ? 'anthropic' : 'gemini',
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  // Verified via https://ai.google.dev/gemini-api/docs/pricing and
  // https://ai.google.dev/gemini-api/docs/models (2026-08-07): stable release,
  // free-tier "Free of charge" pricing, multimodal (accepts image input).
  geminiModel: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
  dbPath,
  dashboardPort: Number(process.env.DASHBOARD_PORT) || 3001,
};
