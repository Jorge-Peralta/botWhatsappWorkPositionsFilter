import { config } from '../config.js';
import { logger } from '../logger.js';
import { getSettings } from '../storage/settingsStore.js';
import { normalizeDraft } from './cvUpload.js';
import { buildCvProfilePrompt } from './prompt.js';
import * as anthropicCvProfile from './providers/anthropicCvProfile.js';
import * as geminiCvProfile from './providers/geminiCvProfile.js';
import type { CvInput, CvProfileOutcome } from './types.js';

const log = logger.child({ module: 'generateProfileFromCv' });

/**
 * Drafts profile + keyword settings from a CV with the configured LLM
 * provider. Never throws — failures resolve to a skippedReason. Persists
 * nothing; the dashboard shows the draft for review before saving.
 */
export async function generateProfileFromCv(cv: CvInput): Promise<CvProfileOutcome> {
  const providerApiKeyConfigured =
    config.extractionProvider === 'anthropic' ? config.anthropicApiKey : config.geminiApiKey;

  if (!providerApiKeyConfigured) {
    log.warn({ provider: config.extractionProvider }, 'API key not configured; cannot draft profile from CV');
    return { draft: null, skippedReason: 'api_key_not_configured' };
  }

  try {
    const prompt = buildCvProfilePrompt(getSettings());
    const provider = config.extractionProvider === 'anthropic' ? anthropicCvProfile : geminiCvProfile;
    const draft = await provider.draftProfile(cv, prompt);
    return draft ? { draft: normalizeDraft(draft), skippedReason: null } : { draft: null, skippedReason: 'llm_no_output' };
  } catch (err) {
    log.warn({ err }, 'CV profile drafting threw an error');
    return { draft: null, skippedReason: 'llm_error' };
  }
}
