import 'dotenv/config';
import path from 'node:path';
import express, { type Request, type Response } from 'express';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { initDb } from '../storage/db.js';
import { getJobById, listJobs, updateStatus, type JobRow, type JobStatus } from '../storage/jobStore.js';
import {
  CANDIDATE_GENDERS,
  NOTIFICATION_LANGUAGES,
  getSettings,
  updateSettings,
  type SettingsRow,
} from '../storage/settingsStore.js';
import { parseCvUpload } from '../profile/cvUpload.js';
import { normalizePhoneNumbers } from '../whatsapp/phoneNumber.js';
import { generateProfileFromCv } from '../profile/generateProfileFromCv.js';
import type { ExtractedJobData } from '../extraction/types.js';
import type { CvProfileSkippedReason } from '../profile/types.js';

const log = logger.child({ module: 'dashboardServer' });

const CV_PROFILE_ERRORS: Record<CvProfileSkippedReason, string> = {
  api_key_not_configured: 'No LLM API key is configured for the selected provider.',
  llm_no_output: 'The LLM could not draft a profile from this CV. Try another file or a text version.',
  llm_error: 'Drafting the profile failed. Check the dashboard API logs.',
};

const VALID_STATUSES: JobStatus[] = ['new', 'reviewed', 'applied', 'discarded'];

function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === 'string' && (VALID_STATUSES as string[]).includes(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isValidSettingsPayload(body: unknown): body is SettingsRow {
  if (typeof body !== 'object' || body === null) return false;
  const payload = body as Record<string, unknown>;

  return (
    typeof payload.profile === 'string' &&
    payload.profile.trim().length > 0 &&
    typeof payload.threshold === 'number' &&
    Number.isFinite(payload.threshold) &&
    payload.threshold >= 0 &&
    payload.threshold <= 100 &&
    isStringArray(payload.keywordsEs) &&
    isStringArray(payload.keywordsEn) &&
    isStringArray(payload.skillKeywords) &&
    isStringArray(payload.acronyms) &&
    typeof payload.country === 'string' &&
    typeof payload.language === 'string' &&
    typeof payload.keywordFilterEnabled === 'boolean' &&
    (CANDIDATE_GENDERS as readonly unknown[]).includes(payload.candidateGender) &&
    typeof payload.acceptLowerLevelRoles === 'boolean' &&
    typeof payload.acceptEntryLevelAnyField === 'boolean' &&
    (NOTIFICATION_LANGUAGES as readonly unknown[]).includes(payload.notificationLanguage) &&
    Array.isArray(payload.notifyNumbers) &&
    payload.notifyNumbers.every((item) => typeof item === 'string') &&
    normalizePhoneNumbers(payload.notifyNumbers as string[]) !== null
  );
}

function parseExtracted(extractedJson: string | null): ExtractedJobData | null {
  if (!extractedJson) return null;
  try {
    return JSON.parse(extractedJson) as ExtractedJobData;
  } catch {
    return null;
  }
}

// image_path is stored as an absolute filesystem path under config.imagesDir
// (see imageStore.ts). The dashboard serves that directory at /images, so
// the frontend-facing URL is the path relative to imagesDir.
function toImageUrl(imagePath: string): string {
  const relative = path.relative(config.imagesDir, imagePath).split(path.sep).join('/');
  return `/images/${relative}`;
}

function serializeJob(row: JobRow) {
  return {
    ...row,
    extracted: parseExtracted(row.extracted_json),
    image_url: toImageUrl(row.image_path),
  };
}

initDb();

const app = express();

// Registered before the global JSON parser: a base64-encoded CV (up to
// MAX_CV_BYTES raw) is far over express.json()'s 100kb default limit.
app.post('/api/profile/from-cv', express.json({ limit: '8mb' }), async (req: Request, res: Response) => {
  const upload = parseCvUpload(req.body);
  if (!upload.ok) {
    res.status(400).json({ error: upload.error });
    return;
  }

  const outcome = await generateProfileFromCv(upload.cv, upload.options);
  if (!outcome.draft) {
    const status = outcome.skippedReason === 'api_key_not_configured' ? 503 : 502;
    res.status(status).json({ error: CV_PROFILE_ERRORS[outcome.skippedReason ?? 'llm_error'] });
    return;
  }

  res.json(outcome.draft);
});

app.use(express.json());

app.get('/api/jobs', (req: Request, res: Response) => {
  const { status, limit, offset } = req.query;

  if (status !== undefined && !isJobStatus(status)) {
    res.status(400).json({ error: `invalid status: ${String(status)}` });
    return;
  }

  const parsedLimit = limit !== undefined ? Number(limit) : undefined;
  const parsedOffset = offset !== undefined ? Number(offset) : undefined;

  const rows = listJobs({
    status,
    limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    offset: Number.isFinite(parsedOffset) ? parsedOffset : undefined,
  });

  res.json(rows.map(serializeJob));
});

app.get('/api/jobs/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'invalid job id' });
    return;
  }

  const row = getJobById(id);
  if (!row) {
    res.status(404).json({ error: 'job not found' });
    return;
  }

  res.json(serializeJob(row));
});

app.patch('/api/jobs/:id/status', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'invalid job id' });
    return;
  }

  const { status } = req.body as { status?: unknown };
  if (!isJobStatus(status)) {
    res.status(400).json({ error: `invalid status: ${String(status)}` });
    return;
  }

  const existing = getJobById(id);
  if (!existing) {
    res.status(404).json({ error: 'job not found' });
    return;
  }

  updateStatus(id, status);
  res.json(serializeJob(getJobById(id)!));
});

app.get('/api/settings', (req: Request, res: Response) => {
  res.json(getSettings());
});

app.put('/api/settings', (req: Request, res: Response) => {
  if (!isValidSettingsPayload(req.body)) {
    res.status(400).json({ error: 'invalid settings payload' });
    return;
  }

  const updated = updateSettings({ ...req.body, notifyNumbers: normalizePhoneNumbers(req.body.notifyNumbers)! });
  res.json(updated);
});

app.use('/images', express.static(config.imagesDir));

app.listen(config.dashboardPort, () => {
  log.info({ port: config.dashboardPort }, 'dashboard API server listening');
});
