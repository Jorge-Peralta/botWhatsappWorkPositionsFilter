import { describeRegion } from '../extraction/prompt.js';
import type { ExtractedJobData } from '../extraction/types.js';
import type { JobRow } from '../storage/jobStore.js';
import type { SettingsRow } from '../storage/settingsStore.js';

// The settings the relevance scorer reads, besides the feedback examples.
export type RelevanceCandidate = Pick<
  SettingsRow,
  'profile' | 'country' | 'language' | 'candidateGender' | 'acceptLowerLevelRoles' | 'acceptEntryLevelAnyField'
>;

// Extra rules derived from candidate settings rather than the free-text
// profile, so they apply consistently whatever the profile says.
function buildScreeningRules(candidate: RelevanceCandidate): string[] {
  const rules: string[] = [];
  if (candidate.candidateGender !== 'unspecified') {
    rules.push(
      `The candidate's gender: ${candidate.candidateGender}. If the flyer explicitly requires a different gender ` +
        '(e.g. "se busca mujer", "sexo masculino"), score it 0-15 and say so. Do not penalize flyers that state no ' +
        'gender requirement.',
    );
  }
  if (candidate.acceptLowerLevelRoles) {
    rules.push(
      'The candidate is also open to lower-level roles in their own field (assistant, junior, auxiliary or ' +
        'technician positions). Do not apply an overqualification penalty: score a lower-level role in their ' +
        'field as a good match (60+) unless another requirement disqualifies them.',
    );
  }
  if (candidate.acceptEntryLevelAnyField) {
    rules.push(
      'The candidate also accepts general entry-level jobs in any field (e.g. cashier, warehouse, customer ' +
        'service, sales) that need no specific experience or credentials they lack. Score such a job at least 60 ' +
        'when no stated requirement disqualifies them, and say it is an entry-level match.',
    );
  }
  return rules;
}

function buildBasePrompt(candidate: RelevanceCandidate): string {
  const regionHint = describeRegion(candidate);
  const rules = buildScreeningRules(candidate);
  return (
    `You are screening a WhatsApp job-listing flyer${regionHint ? ` (${regionHint})` : ''} against a ` +
    'candidate profile. Score how well THIS SPECIFIC job posting matches the candidate, from 0 ' +
    '(no match) to 100 (excellent match). The candidate may work in any profession or trade. Weigh ' +
    'role and skills fit most heavily (required skills, experience, certifications or licenses), then ' +
    'location/work-arrangement fit, then seniority fit. Respect any dealbreakers stated in the profile. ' +
    'The candidate is actively job hunting and missing a good match ' +
    'is worse than an extra notification — when genuinely uncertain, lean toward a higher score rather ' +
    'than a lower one. If the extracted data is too sparse to judge (e.g. no title and no requirements), ' +
    'score it low (0-20) and say so in the reasoning.\n\n' +
    (rules.length ? `Screening rules:\n${rules.map((rule) => `- ${rule}`).join('\n')}\n\n` : '') +
    `Candidate profile:\n${candidate.profile}`
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
export function buildRelevancePrompt(
  examples: { positive: JobRow[]; negative: JobRow[] },
  candidate: RelevanceCandidate,
): string {
  const basePrompt = buildBasePrompt(candidate);

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
