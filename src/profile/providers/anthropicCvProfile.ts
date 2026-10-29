import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { CV_PROFILE_SCHEMA } from '../schema.js';
import type { CvInput, CvProfileDraft } from '../types.js';

const log = logger.child({ module: 'anthropicCvProfile' });

// Lazily-initialized module-level singleton so importing this file doesn't
// throw (or attempt credential resolution) when no API key is configured.
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

function toContentBlock(cv: CvInput): Anthropic.Messages.ContentBlockParam {
  if (cv.kind === 'pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: cv.base64 } };
  }
  return { type: 'text', text: `CV:\n${cv.text}` };
}

export async function draftProfile(cv: CvInput, prompt: string): Promise<CvProfileDraft | null> {
  const response = await getClient().messages.parse({
    model: config.extractionModel,
    max_tokens: 2000,
    output_config: {
      format: jsonSchemaOutputFormat(CV_PROFILE_SCHEMA),
    },
    messages: [
      {
        role: 'user',
        content: [toContentBlock(cv), { type: 'text', text: prompt }],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    log.warn({ stopReason: response.stop_reason }, 'CV profile drafting refused by model');
    return null;
  }

  if (!response.parsed_output) {
    log.warn({ stopReason: response.stop_reason }, 'CV profile drafting returned no parsed output');
    return null;
  }

  return response.parsed_output;
}
