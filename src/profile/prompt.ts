import { describeRegion } from '../extraction/prompt.js';
import type { JobRegion } from '../storage/settingsStore.js';
import type { CvProfileOptions } from './types.js';

/**
 * Prompt for turning a candidate's CV into the bot's settings: a profile the
 * relevance scorer reads, plus the keyword lists the cheap pre-filters match
 * against flyer text. Profession-agnostic on purpose.
 */
export function buildCvProfilePrompt(region: JobRegion, options: CvProfileOptions): string {
  const regionHint = describeRegion(region);
  const flyerContext = regionHint ? `WhatsApp job flyers (${regionHint})` : 'WhatsApp job flyers';
  const lowerLevelHint = options.acceptLowerLevelRoles
    ? ' The candidate also accepts lower-level roles in their field: also include lower-level and assistant ' +
      'titles in the same field (e.g. "auxiliar de enfermeria" for a nurse, "auxiliar contable" for an accountant).'
    : '';

  return (
    `The attached document is a job candidate's CV. They want a bot to screen ${flyerContext} for them. ` +
    'The candidate can be from any profession or trade. Use only facts stated in the CV — do not invent ' +
    'experience, skills, salary expectations or preferences.\n\n' +
    'Produce:\n' +
    '1. profile: a concise candidate profile as short bullet lines, in English, with these sections when ' +
    'the CV supports them: target roles; seniority and years of experience; core skills; secondary skills; ' +
    'education, certifications or licenses; languages; location and work arrangement; dealbreakers. ' +
    'For preferences the CV does not state (salary floor, dealbreakers, work arrangement), add a line ' +
    'like "- Dealbreakers: (fill in)" so the candidate can complete it.\n' +
    '2. keywordsEs: Spanish job titles and role words this candidate would match, as they would appear on a ' +
    'flyer, without accents being required, including feminine and masculine forms (e.g. "contador", "contadora").' +
    `${lowerLevelHint}\n` +
    '3. keywordsEn: the English equivalents.\n' +
    '4. skillKeywords: distinctive skills, tools, certifications or licenses from the CV that a flyer for a ' +
    'matching job would mention. Avoid generic words (e.g. "experiencia", "trabajo", "responsable") that ' +
    'appear on almost every flyer.\n' +
    '5. acronyms: only short uppercase acronyms relevant to the field that must match with exact case ' +
    '(e.g. "RRHH", "TI"); empty when none apply.\n\n' +
    'Keep each keyword list focused: roughly 5-20 entries.'
  );
}
