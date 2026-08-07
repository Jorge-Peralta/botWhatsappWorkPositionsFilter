import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { ExtractionOutcome } from '../extraction/types.js';

const log = logger.child({ module: 'imageStore' });

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

export interface SaveImageParams {
  groupJid: string;
  sender: string;
  timestamp: number | Long | null | undefined;
  mimetype: string | null | undefined;
  fileLength: number | Long | null | undefined;
  caption?: string | null;
  messageId?: string | null;
  buffer: Buffer;
}

export interface SaveImageResult {
  imagePath: string;
  metadataPath: string;
}

// Baileys uses Long for some numeric fields depending on build; avoid a hard
// dependency on the `long` package here by accepting anything number-like.
type Long = { toNumber(): number };

function toPlainNumber(value: number | Long | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return null;
}

function sanitizeForPath(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extensionForMimetype(mimetype: string | null | undefined): string {
  if (!mimetype) return 'bin';
  const normalized = mimetype.split(';')[0]?.trim().toLowerCase();
  return MIME_TO_EXT[normalized ?? ''] ?? 'bin';
}

export async function save(params: SaveImageParams): Promise<SaveImageResult> {
  const { groupJid, sender, timestamp, mimetype, fileLength, caption, messageId, buffer } = params;

  const groupDir = path.join(config.imagesDir, sanitizeForPath(groupJid));
  fs.mkdirSync(groupDir, { recursive: true });

  const isoTimestamp = new Date((toPlainNumber(timestamp) ?? Math.floor(Date.now() / 1000)) * 1000)
    .toISOString()
    .replace(/[:.]/g, '-');
  const suffix = messageId ? sanitizeForPath(messageId) : crypto.randomBytes(6).toString('hex');
  const ext = extensionForMimetype(mimetype);
  const baseName = `${isoTimestamp}_${suffix}`;

  const imagePath = path.join(groupDir, `${baseName}.${ext}`);
  const metadataPath = path.join(groupDir, `${baseName}.json`);

  const metadata = {
    groupJid,
    sender,
    timestamp: toPlainNumber(timestamp),
    mimetype: mimetype ?? null,
    fileLength: toPlainNumber(fileLength),
    caption: caption ?? null,
    messageId: messageId ?? null,
    savedAt: new Date().toISOString(),
    imageFile: path.basename(imagePath),
  };

  await fs.promises.writeFile(imagePath, buffer);
  await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  log.debug({ imagePath, metadataPath }, 'saved image + metadata');

  return { imagePath, metadataPath };
}

/**
 * Merges a Phase 2 extraction outcome into the sidecar JSON written by
 * save(). Kept separate from save() so extraction can run after the image
 * is already persisted, without changing save()'s existing contract.
 */
export async function updateExtraction(metadataPath: string, outcome: ExtractionOutcome): Promise<void> {
  const raw = await fs.promises.readFile(metadataPath, 'utf-8');
  const existing = JSON.parse(raw) as Record<string, unknown>;

  const merged = {
    ...existing,
    ocrPreFilterResult: outcome.ocrPreFilterResult,
    extracted: outcome.extracted,
    extractionSkippedReason: outcome.extractionSkippedReason,
    extractionUpdatedAt: new Date().toISOString(),
  };

  await fs.promises.writeFile(metadataPath, JSON.stringify(merged, null, 2), 'utf-8');

  log.debug({ metadataPath }, 'updated image metadata with extraction outcome');
}
