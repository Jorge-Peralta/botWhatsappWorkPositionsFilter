// JSON schema for structured vision extraction output, matching
// ExtractedJobData in types.ts. Passed to Anthropic's structured-outputs
// API via output_config.format (see visionExtract.ts).
export const JOB_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    title: {
      type: ['string', 'null'],
      description: 'The job title / role advertised in the flyer.',
    },
    company: {
      type: ['string', 'null'],
      description: 'The hiring company or organization name.',
    },
    location: {
      type: ['string', 'null'],
      description: 'The job location (city, department, or "remote").',
    },
    requirements: {
      type: 'array',
      items: { type: 'string' },
      description: 'List of requirements or qualifications mentioned in the flyer.',
    },
    salary: {
      type: ['string', 'null'],
      description: 'Salary or compensation information, if present in the flyer.',
    },
    contactMethod: {
      type: ['string', 'null'],
      description: 'How to apply or make contact (phone number, email, WhatsApp, link, etc).',
    },
  },
  required: ['title', 'company', 'location', 'requirements', 'salary', 'contactMethod'],
  additionalProperties: false,
} as const;
