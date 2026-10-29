import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { logger } from '../../logger.js';
import { resolveExtractionModel } from '../modelSelector.js';
import { JOB_EXTRACTION_SCHEMA } from '../schema.js';
import type { ResizedImage } from '../imageResize.js';
import type { ExtractedJobData } from '../types.js';

const log = logger.child({ module: 'anthropicVision' });

// Lazily-initialized module-level singleton so importing this file doesn't
// throw (or attempt credential resolution) when no API key is configured.
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

export async function extractWithVision(image: ResizedImage, prompt: string): Promise<ExtractedJobData | null> {
  const anthropicClient = getClient();
  const model = await resolveExtractionModel(anthropicClient);

  const response = await anthropicClient.messages.parse({
    model,
    max_tokens: 500,
    output_config: {
      format: jsonSchemaOutputFormat(JOB_EXTRACTION_SCHEMA),
    },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: image.mediaType,
              data: image.base64,
            },
          },
          { type: 'text', text: prompt },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    log.warn({ stopReason: response.stop_reason }, 'vision extraction refused by model');
    return null;
  }

  if (!response.parsed_output) {
    log.warn({ stopReason: response.stop_reason }, 'vision extraction returned no parsed output');
    return null;
  }

  return response.parsed_output;
}
