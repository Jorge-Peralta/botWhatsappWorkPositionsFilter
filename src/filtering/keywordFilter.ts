import { containsItKeyword } from '../extraction/keywords.js';
import { getSettings } from '../storage/settingsStore.js';
import type { ExtractedJobData, OcrPreFilterResult } from '../extraction/types.js';

export interface KeywordFilterResult {
  keywordMatch: boolean | null; // null = insufficient data to decide
  matchedKeyword: string | null;
}

export interface EvaluateKeywordFilterInput {
  extracted: ExtractedJobData | null;
  ocrPreFilterResult: OcrPreFilterResult | null;
  caption: string | null;
}

/**
 * Fast pass over already-produced extraction data to decide whether a flyer
 * is IT-relevant. Separate from ocrPreFilter.ts's use of containsItKeyword,
 * which only gates the paid vision LLM call — this runs after extraction (or
 * after a duplicate skip) to decide persistence status.
 */
export function evaluateKeywordFilter(input: EvaluateKeywordFilterInput): KeywordFilterResult {
  const settings = getSettings();
  const keywordSets = {
    keywordsEs: settings.keywordsEs,
    keywordsEn: settings.keywordsEn,
    techKeywords: settings.techKeywords,
    acronyms: settings.acronyms,
  };

  if (input.extracted) {
    const haystack = [
      input.extracted.title ?? '',
      input.extracted.requirements.join(' '),
      input.caption ?? '',
    ].join(' ');
    const { matched, keyword } = containsItKeyword(haystack, keywordSets);
    return { keywordMatch: matched, matchedKeyword: keyword };
  }

  if (input.ocrPreFilterResult?.text) {
    const { matched, keyword } = containsItKeyword(input.ocrPreFilterResult.text, keywordSets);
    return { keywordMatch: matched, matchedKeyword: keyword };
  }

  return { keywordMatch: null, matchedKeyword: null };
}
