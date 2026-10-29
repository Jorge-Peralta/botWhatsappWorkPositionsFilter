// JSON schema for structured relevance-scoring output, matching
// RelevanceScore in types.ts. Passed to Anthropic's structured-outputs
// API via output_config.format (see providers/anthropicRelevance.ts).
export const RELEVANCE_SCHEMA = {
  type: 'object',
  properties: {
    score: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description:
        'Relevance score 0-100 for how well this job matches the candidate profile; 100 = perfect match, 0 = no match at all.',
    },
    reasoning: {
      type: 'string',
      description:
        'One to two sentence explanation for the score, citing specific profile fit or mismatch (role, skills, location, seniority).',
    },
  },
  required: ['score', 'reasoning'],
  additionalProperties: false,
} as const;
