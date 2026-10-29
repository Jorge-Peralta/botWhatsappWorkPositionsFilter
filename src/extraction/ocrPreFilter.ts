import fs from 'node:fs';
import path from 'node:path';
import Tesseract from 'tesseract.js';
import { logger } from '../logger.js';
import { containsKeyword } from './keywords.js';
import { getSettings } from '../storage/settingsStore.js';
import type { OcrPreFilterResult } from './types.js';

const log = logger.child({ module: 'ocrPreFilter' });

const MIN_CONFIDENCE = 60;
const MIN_TEXT_LENGTH = 20;

const tesseractCacheDir = path.resolve(process.cwd(), './data/tesseract-cache');
fs.mkdirSync(tesseractCacheDir, { recursive: true });

// Module-level singleton worker, lazily initialized on first use and reused
// across calls — creating a new tesseract.js worker per call is expensive
// (it loads WASM + language traineddata every time).
let workerPromise: Promise<Tesseract.Worker> | null = null;

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker(['eng', 'spa'], undefined, {
      cachePath: tesseractCacheDir,
    });
  }
  return workerPromise;
}

export async function runOcrPreFilter(buffer: Buffer): Promise<OcrPreFilterResult> {
  const worker = await getWorker();
  const { data } = await worker.recognize(buffer);

  const text = data.text ?? '';
  const confidence = data.confidence ?? 0;
  const settings = getSettings();
  const { matched, keyword } = containsKeyword(text, {
    keywordsEs: settings.keywordsEs,
    keywordsEn: settings.keywordsEn,
    skillKeywords: settings.skillKeywords,
    acronyms: settings.acronyms,
  });

  if (matched) {
    return {
      text,
      confidence,
      hasKeyword: true,
      matchedKeyword: keyword,
      decision: 'proceed',
      reason: 'keyword_match',
    };
  }

  if (confidence < MIN_CONFIDENCE || text.trim().length < MIN_TEXT_LENGTH) {
    return {
      text,
      confidence,
      hasKeyword: false,
      matchedKeyword: null,
      decision: 'proceed',
      reason: 'low_confidence_or_sparse_text',
    };
  }

  log.debug({ confidence, textLength: text.trim().length }, 'OCR pre-filter skipping flyer with no profile keywords');
  return {
    text,
    confidence,
    hasKeyword: false,
    matchedKeyword: null,
    decision: 'skip',
    reason: 'no_keywords_high_confidence',
  };
}
