import { GoogleGenAI, Type, type Schema } from '@google/genai';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import type { ResizedImage } from '../imageResize.js';
import type { ExtractedJobData } from '../types.js';

const log = logger.child({ module: 'geminiVision' });

// The installed @google/genai SDK's `responseSchema` config field takes the
// OpenAPI-flavored `Schema` type (see node_modules/@google/genai/dist/genai.d.ts),
// not standard JSON Schema. Nullable fields use `nullable: true` alongside a
// single `type`, not the `type: ['string', 'null']` union used by
// JOB_EXTRACTION_SCHEMA in ../schema.ts (that shape is Anthropic-specific).
const GEMINI_JOB_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      nullable: true,
      description: 'The job title / role advertised in the flyer.',
    },
    company: {
      type: Type.STRING,
      nullable: true,
      description: 'The hiring company or organization name.',
    },
    location: {
      type: Type.STRING,
      nullable: true,
      description: 'The job location (city, department, or "remote").',
    },
    requirements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of requirements or qualifications mentioned in the flyer.',
    },
    salary: {
      type: Type.STRING,
      nullable: true,
      description: 'Salary or compensation information, if present in the flyer.',
    },
    contactMethod: {
      type: Type.STRING,
      nullable: true,
      description: 'How to apply or make contact (phone number, email, WhatsApp, link, etc).',
    },
  },
  required: ['title', 'company', 'location', 'requirements', 'salary', 'contactMethod'],
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

export async function extractWithVision(image: ResizedImage, prompt: string): Promise<ExtractedJobData | null> {
  try {
    const geminiClient = getClient();

    const response = await geminiClient.models.generateContent({
      model: config.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { data: image.base64, mimeType: image.mediaType } },
          ],
        },
      ],
      config: {
        maxOutputTokens: 500,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_JOB_SCHEMA,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      log.warn({ finishReason }, 'vision extraction did not finish normally');
      return null;
    }

    if (!response.text) {
      log.warn({ finishReason }, 'vision extraction returned no text output');
      return null;
    }

    return JSON.parse(response.text) as ExtractedJobData;
  } catch (err) {
    log.warn({ err }, 'vision extraction failed');
    return null;
  }
}
