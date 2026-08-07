import type { ExtractedJobData } from '../extraction/types.js';
import type { JobRow } from '../storage/jobStore.js';

function buildBasePrompt(profile: string): string {
  return (
    'You are screening a WhatsApp job-listing flyer (likely in Spanish, from Honduras) against a ' +
    'candidate profile. Score how well THIS SPECIFIC job posting matches the candidate, from 0 ' +
    '(no match) to 100 (excellent match). Weigh stack/role fit most heavily, then location/remote-' +
    'friendliness, then seniority fit. The candidate is actively job hunting and missing a good match ' +
    'is worse than an extra notification — when genuinely uncertain, lean toward a higher score rather ' +
    'than a lower one. If the extracted data is too sparse to judge (e.g. no title and no requirements), ' +
    'score it low (0-20) and say so in the reasoning.\n\n' +
    `Candidate profile:\n${profile}`
  );
}

function parseExtracted(extractedJson: string | null): ExtractedJobData | null {
  if (!extractedJson) return null;
  try {
    return JSON.parse(extractedJson) as ExtractedJobData;
  } catch {
    return null;
  }
}

function formatFeedbackExample(job: JobRow, verdict: 'good match (applied)' | 'not a match (discarded)'): string {
  const extracted = parseExtracted(job.extracted_json);
  const title = extracted?.title ?? '(no title)';
  const company = extracted?.company ?? '(no company)';
  const lines = [`- "${title}" at ${company} — ${verdict}`];
  if (job.relevance_reasoning) {
    lines.push(`  Previous reasoning: ${job.relevance_reasoning}`);
  }
  return lines.join('\n');
}

/**
 * Builds the relevance-scoring prompt, optionally appending a "Past feedback
 * from this candidate" section built from manually-reviewed jobs (applied =
 * positive signal, discarded-by-a-human = negative signal). Called fresh per
 * scoring request so the feedback stays current as new jobs get reviewed.
 */
export function buildRelevancePrompt(examples: { positive: JobRow[]; negative: JobRow[] }, profile: string): string {
  const basePrompt = buildBasePrompt(profile);

  if (examples.positive.length === 0 && examples.negative.length === 0) {
    return basePrompt;
  }

  const sections = [basePrompt, '\n\nPast feedback from this candidate:'];
  for (const job of examples.positive) {
    sections.push(formatFeedbackExample(job, 'good match (applied)'));
  }
  for (const job of examples.negative) {
    sections.push(formatFeedbackExample(job, 'not a match (discarded)'));
  }
  return sections.join('\n');
}

// Renders the already-extracted job data as the per-call user-turn content,
// standing in for the image block used by the extraction-phase prompt (this
// is a text-only call).
export function formatJobForRelevancePrompt(input: { extracted: ExtractedJobData; caption: string | null }): string {
  const { extracted, caption } = input;
  return [
    'Job flyer data (already extracted from the image):',
    `Title: ${extracted.title ?? '(none)'}`,
    `Company: ${extracted.company ?? '(none)'}`,
    `Location: ${extracted.location ?? '(none)'}`,
    `Requirements: ${extracted.requirements.length ? extracted.requirements.join('; ') : '(none listed)'}`,
    `Salary: ${extracted.salary ?? '(none)'}`,
    `Contact method: ${extracted.contactMethod ?? '(none)'}`,
    caption ? `Original caption/text: ${caption}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}
