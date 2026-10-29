import { containsKeyword } from '../extraction/keywords.js';
import { getSettings } from '../storage/settingsStore.js';
import type { ExtractedJobData, OcrPreFilterResult } from '../extraction/types.js';

export interface KeywordFilterResult {
  keywordMatch: boolean | null; // null = insufficient data to decide, or filter disabled
  matchedKeyword: string | null;
}

export interface EvaluateKeywordFilterInput {
  extracted: ExtractedJobData | null;
  ocrPreFilterResult: OcrPreFilterResult | null;
  caption: string | null;
}

/**
 * Fast pass over already-produced extraction data to decide whether a flyer
 * is relevant to the candidate's configured keywords. Separate from ocrPreFilter.ts's use of containsKeyword,
 * which only gates the paid vision LLM call — this runs after extraction (or
 * after a duplicate skip) to decide persistence status.
 */
export function evaluateKeywordFilter(input: EvaluateKeywordFilterInput): KeywordFilterResult {
  const settings = getSettings();
  // Abstaining (null) keeps the flyer as 'new' so it still reaches relevance
  // scoring; a false here would discard it as a non-match.
  if (!settings.keywordFilterEnabled) {
    return { keywordMatch: null, matchedKeyword: null };
  }

  const keywordSets = {
    keywordsEs: settings.keywordsEs,
    keywordsEn: settings.keywordsEn,
    skillKeywords: settings.skillKeywords,
    acronyms: settings.acronyms,
  };

  if (input.extracted) {
    const haystack = [
      input.extracted.title ?? '',
      input.extracted.requirements.join(' '),
      input.caption ?? '',
    ].join(' ');
    const { matched, keyword } = containsKeyword(haystack, keywordSets);
    return { keywordMatch: matched, matchedKeyword: keyword };
  }

  if (input.ocrPreFilterResult?.text) {
    const { matched, keyword } = containsKeyword(input.ocrPreFilterResult.text, keywordSets);
    return { keywordMatch: matched, matchedKeyword: keyword };
  }

  return { keywordMatch: null, matchedKeyword: null };
}
