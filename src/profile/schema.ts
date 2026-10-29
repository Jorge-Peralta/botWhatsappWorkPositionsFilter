// JSON schema for structured CV-to-profile output, matching CvProfileDraft in
// types.ts. Passed to Anthropic's structured-outputs API via
// output_config.format (see providers/anthropicCvProfile.ts).
const keywordList = (description: string) => ({ type: 'array', items: { type: 'string' }, description }) as const;

export const CV_PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    profile: { type: 'string', description: 'Candidate profile as short bullet lines, in English.' },
    keywordsEs: keywordList('Spanish job titles and role words the candidate matches.'),
    keywordsEn: keywordList('English job titles and role words the candidate matches.'),
    skillKeywords: keywordList('Distinctive skills, tools, certifications or licenses from the CV.'),
    acronyms: keywordList('Short uppercase acronyms that must match with exact case; may be empty.'),
  },
  required: ['profile', 'keywordsEs', 'keywordsEn', 'skillKeywords', 'acronyms'],
  additionalProperties: false,
} as const;
