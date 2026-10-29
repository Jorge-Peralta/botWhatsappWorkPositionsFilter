export interface OcrPreFilterResult {
  text: string;
  confidence: number;
  hasKeyword: boolean;
  matchedKeyword: string | null;
  decision: 'skip' | 'proceed';
  reason: 'keyword_match' | 'keyword_filter_disabled' | 'low_confidence_or_sparse_text' | 'no_keywords_high_confidence';
}

export interface ExtractedJobData {
  title: string | null;
  company: string | null;
  location: string | null;
  requirements: string[];
  salary: string | null;
  contactMethod: string | null;
}

export type ExtractionSkippedReason =
  | null
  | 'ocr_failed'
  | 'non_it_ocr_filtered'
  | 'api_key_not_configured'
  | 'vision_extraction_failed'
  | 'vision_extraction_error'
  | 'duplicate_repost';

export interface ExtractionOutcome {
  ocrPreFilterResult: OcrPreFilterResult | null;
  extracted: ExtractedJobData | null;
  extractionSkippedReason: ExtractionSkippedReason;
}
