import type { SettingsRow } from '../storage/settingsStore.js';

// A CV as handed to the LLM: PDFs go through as native document input (both
// providers read PDFs directly), text files as plain text.
export type CvInput = { kind: 'pdf'; base64: string } | { kind: 'text'; text: string };

// The settings fields a CV can fill in. Never saved directly — the dashboard
// loads it into the settings form for the candidate to review first.
export type CvProfileDraft = Pick<SettingsRow, 'profile' | 'keywordsEs' | 'keywordsEn' | 'skillKeywords' | 'acronyms'>;

// Comes from the (possibly unsaved) settings form, so the draft matches what
// the candidate is about to save rather than the stored settings.
export interface CvProfileOptions {
  acceptLowerLevelRoles: boolean;
}

export type CvProfileSkippedReason = 'api_key_not_configured' | 'llm_no_output' | 'llm_error';

export interface CvProfileOutcome {
  draft: CvProfileDraft | null;
  skippedReason: CvProfileSkippedReason | null;
}
