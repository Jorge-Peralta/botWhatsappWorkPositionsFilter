import Anthropic from '@anthropic-ai/sdk';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { buildRelevancePrompt, formatJobForRelevancePrompt } from '../prompt.js';
import { RELEVANCE_SCHEMA } from '../schema.js';
import type { DispatchRelevanceInput } from '../dispatchRelevance.js';
import type { RelevanceScore } from '../types.js';

const log = logger.child({ module: 'anthropicRelevance' });

// Lazily-initialized module-level singleton so importing this file doesn't
// throw (or attempt credential resolution) when no API key is configured.
let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

// Note: unlike vision extraction, relevance scoring is text-only and does not
// need vision-capability resolution — use config.extractionModel directly.
export async function scoreRelevance(input: DispatchRelevanceInput): Promise<RelevanceScore | null> {
  const anthropicClient = getClient();

  const response = await anthropicClient.messages.parse({
    model: config.extractionModel,
    max_tokens: 300,
    output_config: {
      format: jsonSchemaOutputFormat(RELEVANCE_SCHEMA),
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: buildRelevancePrompt(input.examples, input.profile) },
          { type: 'text', text: formatJobForRelevancePrompt(input) },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    log.warn({ stopReason: response.stop_reason }, 'relevance scoring refused by model');
    return null;
  }

  if (!response.parsed_output) {
    log.warn({ stopReason: response.stop_reason }, 'relevance scoring returned no parsed output');
    return null;
  }

  return response.parsed_output;
}
