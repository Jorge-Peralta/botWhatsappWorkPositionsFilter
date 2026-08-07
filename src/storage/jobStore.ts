import { getDb } from './db.js';
import { hammingDistance } from '../dedup/imageHash.js';
import { logger } from '../logger.js';
import type { ExtractedJobData, ExtractionSkippedReason } from '../extraction/types.js';
import type { RelevanceSkippedReason } from '../relevance/types.js';

const log = logger.child({ module: 'jobStore' });

const DUPLICATE_HAMMING_THRESHOLD = 8;

export type DiscardReason = 'duplicate' | 'non_it' | null;
export type JobStatus = 'new' | 'reviewed' | 'applied' | 'discarded';

export interface InsertJobParams {
  groupJid: string;
  sender: string | null;
  messageId: string | null;
  messageTimestamp: number | null;
  imagePath: string;
  metadataPath: string;
  imageHash: string;
  duplicateOfId: number | null;
  caption: string | null;
  ocrText: string | null;
  ocrConfidence: number | null;
  ocrHasKeyword: boolean;
  extracted: ExtractedJobData | null;
  extractionSkippedReason: ExtractionSkippedReason;
  keywordMatch: boolean | null;
  matchedKeyword: string | null;
}

export interface JobRow {
  id: number;
  group_jid: string;
  sender: string | null;
  message_id: string | null;
  message_timestamp: number | null;
  image_path: string;
  metadata_path: string;
  image_hash: string;
  duplicate_of_id: number | null;
  caption: string | null;
  ocr_text: string | null;
  ocr_confidence: number | null;
  ocr_has_keyword: number;
  extracted_json: string | null;
  extraction_skipped_reason: string | null;
  keyword_match: number | null;
  matched_keyword: string | null;
  discard_reason: string | null;
  relevance_score: number | null;
  relevance_reasoning: string | null;
  relevance_skipped_reason: string | null;
  notified_at: string | null;
  status: string;
  created_at: string;
}

function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as NodeJS.ErrnoException).code;
  return code === 'ERR_SQLITE_ERROR' && err.message.includes('UNIQUE constraint failed');
}

function deriveDiscardReasonAndStatus(
  duplicateOfId: number | null,
  keywordMatch: boolean | null,
): { discardReason: DiscardReason; status: JobStatus } {
  if (duplicateOfId !== null) {
    return { discardReason: 'duplicate', status: 'discarded' };
  }
  if (keywordMatch === false) {
    return { discardReason: 'non_it', status: 'discarded' };
  }
  return { discardReason: null, status: 'new' };
}

/**
 * Inserts a job row. If `message_id` collides with an existing row (Baileys
 * redelivered a `messages.upsert` event for the same message), the unique
 * constraint on idx_jobs_message_id fires — that's treated as "already
 * recorded" rather than an error, and the existing row's id is returned.
 */
export function insertJob(params: InsertJobParams): number {
  const db = getDb();
  const { discardReason, status } = deriveDiscardReasonAndStatus(params.duplicateOfId, params.keywordMatch);

  const stmt = db.prepare(`
    INSERT INTO jobs (
      group_jid, sender, message_id, message_timestamp,
      image_path, metadata_path, image_hash, duplicate_of_id,
      caption, ocr_text, ocr_confidence, ocr_has_keyword,
      extracted_json, extraction_skipped_reason,
      keyword_match, matched_keyword, discard_reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(
      params.groupJid,
      params.sender,
      params.messageId,
      params.messageTimestamp,
      params.imagePath,
      params.metadataPath,
      params.imageHash,
      params.duplicateOfId,
      params.caption,
      params.ocrText,
      params.ocrConfidence,
      params.ocrHasKeyword ? 1 : 0,
      params.extracted ? JSON.stringify(params.extracted) : null,
      params.extractionSkippedReason,
      params.keywordMatch === null ? null : params.keywordMatch ? 1 : 0,
      params.matchedKeyword,
      discardReason,
      status,
    );
    return Number(result.lastInsertRowid);
  } catch (err) {
    if (isUniqueConstraintError(err) && params.messageId) {
      log.debug({ messageId: params.messageId }, 'message already recorded, returning existing job id');
      const existing = db
        .prepare('SELECT id FROM jobs WHERE message_id = ?')
        .get(params.messageId) as { id: number } | undefined;
      if (existing) return existing.id;
    }
    throw err;
  }
}

/**
 * Full scan of image_hash against every existing row (fine at this scale)
 * looking for a near-duplicate within the Hamming distance threshold.
 */
export function findNearDuplicate(imageHash: string): { id: number } | null {
  const db = getDb();
  const rows = db.prepare('SELECT id, image_hash FROM jobs').all() as {
    id: number;
    image_hash: string;
  }[];

  for (const row of rows) {
    if (hammingDistance(imageHash, row.image_hash) <= DUPLICATE_HAMMING_THRESHOLD) {
      return { id: row.id };
    }
  }
  return null;
}

export function getJobById(id: number): JobRow | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) as JobRow | undefined;
  return row ?? null;
}

export interface ListJobsParams {
  status?: JobStatus;
  limit?: number;
  offset?: number;
}

export function listJobs(params: ListJobsParams = {}): JobRow[] {
  const db = getDb();
  const limit = params.limit ?? 50;
  const offset = params.offset ?? 0;

  if (params.status) {
    return db
      .prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .all(params.status, limit, offset) as unknown as JobRow[];
  }
  return db
    .prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .all(limit, offset) as unknown as JobRow[];
}

/**
 * Pulls the most recent manually-reviewed jobs to use as few-shot relevance
 * signal. The `discard_reason IS NULL` guard on the negative side excludes
 * jobs auto-discarded at insert time (duplicates/non-IT) — those never had a
 * human look at them, so they aren't real negative signal about relevance
 * quality.
 */
export function getFeedbackExamples(): { positive: JobRow[]; negative: JobRow[] } {
  const db = getDb();
  const positive = db
    .prepare("SELECT * FROM jobs WHERE status = 'applied' ORDER BY created_at DESC LIMIT 5")
    .all() as unknown as JobRow[];
  const negative = db
    .prepare(
      "SELECT * FROM jobs WHERE status = 'discarded' AND discard_reason IS NULL ORDER BY created_at DESC LIMIT 5",
    )
    .all() as unknown as JobRow[];
  return { positive, negative };
}

export function updateStatus(id: number, status: JobStatus): void {
  const db = getDb();
  db.prepare('UPDATE jobs SET status = ? WHERE id = ?').run(status, id);
}

export interface SetRelevanceResultParams {
  score: number | null;
  reasoning: string | null;
  skippedReason: RelevanceSkippedReason;
}

export function setRelevanceResult(id: number, result: SetRelevanceResultParams): void {
  const db = getDb();
  db.prepare('UPDATE jobs SET relevance_score = ?, relevance_reasoning = ?, relevance_skipped_reason = ? WHERE id = ?').run(
    result.score,
    result.reasoning,
    result.skippedReason,
    id,
  );
}

export function markNotified(id: number): void {
  const db = getDb();
  db.prepare("UPDATE jobs SET notified_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?").run(id);
}
