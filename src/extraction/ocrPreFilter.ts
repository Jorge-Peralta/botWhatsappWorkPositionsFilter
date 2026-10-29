import fs from 'node:fs';
import path from 'node:path';
import Tesseract from 'tesseract.js';
import { logger } from '../logger.js';
import { containsKeyword, keywordSetsFromSettings, type KeywordSets } from './keywords.js';
import { getSettings } from '../storage/settingsStore.js';
import { preprocessForOcr } from './imageResize.js';
import type { OcrPreFilterResult } from './types.js';

const log = logger.child({ module: 'ocrPreFilter' });

const MIN_CONFIDENCE = 60;
const MIN_TEXT_LENGTH = 20;

const tesseractCacheDir = path.resolve(process.cwd(), './data/tesseract-cache');
fs.mkdirSync(tesseractCacheDir, { recursive: true });

// Profile language names (English and native spellings) to tesseract codes.
const TESSERACT_LANGUAGE_CODES: Record<string, string> = {
  english: 'eng',
  spanish: 'spa',
  español: 'spa',
  espanol: 'spa',
  portuguese: 'por',
  português: 'por',
  portugues: 'por',
  french: 'fra',
  français: 'fra',
  francais: 'fra',
  german: 'deu',
  deutsch: 'deu',
  italian: 'ita',
  italiano: 'ita',
  dutch: 'nld',
};
const KNOWN_CODES = new Set(Object.values(TESSERACT_LANGUAGE_CODES));

/**
 * Tesseract languages for the profile language. English is always included
 * because flyers mix in English terms and the English keyword set is matched
 * too; every extra language slows recognition, so nothing else is added.
 */
export function ocrLanguagesFor(language: string): string[] {
  const normalized = language.trim().toLowerCase();
  const code = TESSERACT_LANGUAGE_CODES[normalized] ?? (KNOWN_CODES.has(normalized) ? normalized : null);
  if (!code) {
    if (normalized) log.warn({ language }, 'No OCR language for profile language; using English only');
    return ['eng'];
  }
  return code === 'eng' ? ['eng'] : [code, 'eng'];
}

// Module-level worker, lazily initialized and reused across calls — creating a
// tesseract.js worker per call is expensive (it loads WASM + language
// traineddata every time). It is rebuilt only when the profile language changes.
let workerPromise: Promise<Tesseract.Worker> | null = null;
let workerLanguagesKey = '';

function getWorker(languages: string[]): Promise<Tesseract.Worker> {
  const key = languages.join('+');
  if (!workerPromise || key !== workerLanguagesKey) {
    const previous = workerPromise;
    previous?.then((worker) => worker.terminate()).catch(() => {});
    workerLanguagesKey = key;
    // Flyers scatter text around photos and banners; the default page layout
    // mode looks for paragraphs and misses most of it. Sparse-text mode reads
    // every text fragment it finds, which surfaced the job title on test flyers.
    workerPromise = Tesseract.createWorker(languages, undefined, {
      cachePath: tesseractCacheDir,
    }).then(async (worker) => {
      await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
      return worker;
    });
  }
  return workerPromise;
}

export async function runOcrPreFilter(buffer: Buffer): Promise<OcrPreFilterResult> {
  const settings = getSettings();
  const worker = await getWorker(ocrLanguagesFor(settings.language));
  const { data } = await worker.recognize(await preprocessForOcr(buffer));

  return classifyOcrText({
    text: data.text ?? '',
    confidence: data.confidence ?? 0,
    keywordSets: keywordSetsFromSettings(settings),
    keywordFilterEnabled: settings.keywordFilterEnabled,
  });
}

export interface ClassifyOcrTextInput {
  text: string;
  confidence: number;
  keywordSets: KeywordSets;
  keywordFilterEnabled: boolean;
}

/**
 * Decides from OCR output whether a flyer is worth the paid vision call. The
 * keyword match is still recorded when the filter is disabled, so
 * ocr_has_keyword stays informative either way.
 */
export function classifyOcrText({ text, confidence, keywordSets, keywordFilterEnabled }: ClassifyOcrTextInput): OcrPreFilterResult {
  const { matched, keyword } = containsKeyword(text, keywordSets);

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

  if (!keywordFilterEnabled) {
    return {
      text,
      confidence,
      hasKeyword: false,
      matchedKeyword: null,
      decision: 'proceed',
      reason: 'keyword_filter_disabled',
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
