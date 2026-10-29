import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import { buildRelevancePrompt, formatJobForRelevancePrompt } from '../prompt.js';
import type { DispatchRelevanceInput } from '../dispatchRelevance.js';
import type { RelevanceScore } from '../types.js';

const log = logger.child({ module: 'geminiRelevance' });

const GEMINI_RELEVANCE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.INTEGER,
      description:
        'Relevance score 0-100 for how well this job matches the candidate profile; 100 = perfect match, 0 = no match at all.',
    },
    reasoning: {
      type: Type.STRING,
      description:
        'One to two sentence explanation for the score, citing specific profile fit or mismatch (role, skills, location, seniority).',
    },
  },
  required: ['score', 'reasoning'],
};

// Lazily-initialized module-level singleton so importing this file doesn't
// throw (or attempt credential resolution) when no API key is configured.
let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return client;
}

export async function scoreRelevance(input: DispatchRelevanceInput): Promise<RelevanceScore | null> {
  try {
    const geminiClient = getClient();

    const response = await geminiClient.models.generateContent({
      model: config.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: buildRelevancePrompt(input.examples, input.profile) },
            { text: formatJobForRelevancePrompt(input) },
          ],
        },
      ],
      config: {
        maxOutputTokens: 300,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_RELEVANCE_SCHEMA,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      log.warn({ finishReason }, 'relevance scoring did not finish normally');
      return null;
    }

    if (!response.text) {
      log.warn({ finishReason }, 'relevance scoring returned no text output');
      return null;
    }

    return JSON.parse(response.text) as RelevanceScore;
  } catch (err) {
    log.warn({ err }, 'relevance scoring failed');
    return null;
  }
}
