import path from 'node:path';
import type { CvInput, CvProfileDraft } from './types.js';

export const MAX_CV_BYTES = 5 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set(['.txt', '.md']);

export type ParseCvUploadResult = { ok: true; cv: CvInput } | { ok: false; error: string };

/**
 * Validates the dashboard's `{ fileName, mimeType, dataBase64 }` upload body
 * and turns it into a CvInput. The extension is the fallback because browsers
 * often send an empty mime type for .md files.
 */
export function parseCvUpload(body: unknown): ParseCvUploadResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Invalid CV upload payload.' };
  const { fileName, mimeType, dataBase64 } = body as Record<string, unknown>;
  if (typeof fileName !== 'string' || typeof mimeType !== 'string' || typeof dataBase64 !== 'string') {
    return { ok: false, error: 'Invalid CV upload payload.' };
  }

  const extension = path.extname(fileName).toLowerCase();
  const isPdf = mimeType === 'application/pdf' || extension === '.pdf';
  const isText = mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension);
  if (!isPdf && !isText) {
    return { ok: false, error: 'Unsupported CV format. Upload a PDF, .txt or .md file.' };
  }

  const bytes = Buffer.from(dataBase64, 'base64');
  if (bytes.length === 0) return { ok: false, error: 'The CV file is empty.' };
  if (bytes.length > MAX_CV_BYTES) return { ok: false, error: 'The CV file is larger than 5 MB.' };

  return isPdf ? { ok: true, cv: { kind: 'pdf', base64: dataBase64 } } : { ok: true, cv: { kind: 'text', text: bytes.toString('utf-8') } };
}

function cleanList(values: string[], lowercase: boolean): string[] {
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return [...new Set(lowercase ? cleaned.map((value) => value.toLowerCase()) : cleaned)];
}

/**
 * Tidies raw LLM output: keyword matching is already case-insensitive, so
 * keywords are lowercased to make duplicates visible; acronyms match exact
 * case (see keywords.ts) and keep theirs.
 */
export function normalizeDraft(draft: CvProfileDraft): CvProfileDraft {
  return {
    profile: draft.profile.trim(),
    keywordsEs: cleanList(draft.keywordsEs, true),
    keywordsEn: cleanList(draft.keywordsEn, true),
    skillKeywords: cleanList(draft.skillKeywords, true),
    acronyms: cleanList(draft.acronyms, false),
  };
}
