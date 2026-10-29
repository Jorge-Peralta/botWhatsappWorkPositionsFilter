import { config } from '../config.js';
import * as anthropicRelevance from './providers/anthropicRelevance.js';
import * as geminiRelevance from './providers/geminiRelevance.js';
import type { ExtractedJobData } from '../extraction/types.js';
import type { JobRow } from '../storage/jobStore.js';
import type { JobRegion } from '../storage/settingsStore.js';
import type { RelevanceScore } from './types.js';

export interface DispatchRelevanceInput {
  extracted: ExtractedJobData;
  caption: string | null;
  examples: { positive: JobRow[]; negative: JobRow[] };
  profile: string;
  region: JobRegion;
}

export async function dispatchRelevance(input: DispatchRelevanceInput): Promise<RelevanceScore | null> {
  if (config.extractionProvider === 'anthropic') {
    return anthropicRelevance.scoreRelevance(input);
  }
  return geminiRelevance.scoreRelevance(input);
}
