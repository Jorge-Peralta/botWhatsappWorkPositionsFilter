export interface RelevanceScore {
  score: number; // integer 0-100
  reasoning: string;
}

export type RelevanceSkippedReason =
  | null
  | 'no_extracted_data'
  | 'api_key_not_configured'
  | 'llm_no_output'
  | 'llm_error';

export interface RelevanceOutcome {
  relevance: RelevanceScore | null;
  relevanceSkippedReason: RelevanceSkippedReason;
  notifyThreshold: number;
}
