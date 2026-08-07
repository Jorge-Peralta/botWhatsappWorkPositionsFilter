import { config } from '../config.js';
import { logger } from '../logger.js';
import { runOcrPreFilter } from './ocrPreFilter.js';
import { resizeForVision } from './imageResize.js';
import { extractWithVision } from './visionExtract.js';
import type { ExtractionOutcome, OcrPreFilterResult } from './types.js';

const log = logger.child({ module: 'extractJobData' });

export interface ExtractJobDataInput {
  buffer: Buffer;
  caption?: string | null;
}

/**
 * Orchestrates OCR pre-filtering + vision extraction for a captured flyer
 * image. Never throws — every failure mode resolves to an ExtractionOutcome
 * with a populated extractionSkippedReason so callers can persist the
 * outcome unconditionally.
 */
export async function extractJobData(input: ExtractJobDataInput): Promise<ExtractionOutcome> {
  let ocrPreFilterResult: OcrPreFilterResult;
  try {
    ocrPreFilterResult = await runOcrPreFilter(input.buffer);
  } catch (err) {
    log.warn({ err }, 'OCR pre-filter failed');
    return { ocrPreFilterResult: null, extracted: null, extractionSkippedReason: 'ocr_failed' };
  }

  if (ocrPreFilterResult.decision === 'skip') {
    return { ocrPreFilterResult, extracted: null, extractionSkippedReason: 'non_it_ocr_filtered' };
  }

  const providerApiKeyConfigured =
    config.extractionProvider === 'anthropic' ? config.anthropicApiKey : config.geminiApiKey;

  if (!providerApiKeyConfigured) {
    log.warn(
      { provider: config.extractionProvider },
      `${config.extractionProvider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY'} not configured; skipping vision extraction`,
    );
    return {
      ocrPreFilterResult,
      extracted: null,
      extractionSkippedReason: 'api_key_not_configured',
    };
  }

  try {
    const resized = await resizeForVision(input.buffer);
    const extracted = await extractWithVision(resized);
    return {
      ocrPreFilterResult,
      extracted,
      extractionSkippedReason: extracted === null ? 'vision_extraction_failed' : null,
    };
  } catch (err) {
    log.warn({ err }, 'vision extraction threw an error');
    return { ocrPreFilterResult, extracted: null, extractionSkippedReason: 'vision_extraction_error' };
  }
}
