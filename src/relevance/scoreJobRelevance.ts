import { config } from '../config.js';
import { logger } from '../logger.js';
import { dispatchRelevance } from './dispatchRelevance.js';
import { getFeedbackExamples } from '../storage/jobStore.js';
import { getSettings } from '../storage/settingsStore.js';
import type { ExtractedJobData } from '../extraction/types.js';
import type { RelevanceOutcome } from './types.js';

const log = logger.child({ module: 'scoreJobRelevance' });

export interface ScoreJobRelevanceInput {
  extracted: ExtractedJobData;
  caption: string | null;
}

/**
 * Orchestrates LLM relevance scoring for an already-extracted flyer. Never
 * throws — every failure mode resolves to a RelevanceOutcome with a
 * populated relevanceSkippedReason so callers can persist the outcome
 * unconditionally. Reads profile/threshold fresh from settingsStore on every
 * call so dashboard edits apply live without restarting the process.
 */
export async function scoreJobRelevance(input: ScoreJobRelevanceInput): Promise<RelevanceOutcome> {
  const { profile, threshold } = getSettings();

  const providerApiKeyConfigured =
    config.extractionProvider === 'anthropic' ? config.anthropicApiKey : config.geminiApiKey;

  if (!providerApiKeyConfigured) {
    log.warn({ provider: config.extractionProvider }, 'API key not configured; skipping relevance scoring');
    return { relevance: null, relevanceSkippedReason: 'api_key_not_configured', notifyThreshold: threshold };
  }

  try {
    const examples = getFeedbackExamples();
    const relevance = await dispatchRelevance({ ...input, examples, profile });
    return { relevance, relevanceSkippedReason: relevance === null ? 'llm_no_output' : null, notifyThreshold: threshold };
  } catch (err) {
    log.warn({ err }, 'relevance scoring threw an error');
    return { relevance: null, relevanceSkippedReason: 'llm_error', notifyThreshold: threshold };
  }
}
