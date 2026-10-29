import { GoogleGenAI, Type, type Part, type Schema } from '@google/genai';
import { config } from '../../config.js';
import { logger } from '../../logger.js';
import type { CvInput, CvProfileDraft } from '../types.js';

const log = logger.child({ module: 'geminiCvProfile' });

const keywordList = (description: string): Schema => ({ type: Type.ARRAY, items: { type: Type.STRING }, description });

const GEMINI_CV_PROFILE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    profile: { type: Type.STRING, description: 'Candidate profile as short bullet lines, in English.' },
    keywordsEs: keywordList('Spanish job titles and role words the candidate matches.'),
    keywordsEn: keywordList('English job titles and role words the candidate matches.'),
    skillKeywords: keywordList('Distinctive skills, tools, certifications or licenses from the CV.'),
    acronyms: keywordList('Short uppercase acronyms that must match with exact case; may be empty.'),
  },
  required: ['profile', 'keywordsEs', 'keywordsEn', 'skillKeywords', 'acronyms'],
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

function toPart(cv: CvInput): Part {
  if (cv.kind === 'pdf') {
    return { inlineData: { data: cv.base64, mimeType: 'application/pdf' } };
  }
  return { text: `CV:\n${cv.text}` };
}

export async function draftProfile(cv: CvInput, prompt: string): Promise<CvProfileDraft | null> {
  try {
    const response = await getClient().models.generateContent({
      model: config.geminiModel,
      contents: [{ role: 'user', parts: [toPart(cv), { text: prompt }] }],
      config: {
        maxOutputTokens: 2000,
        responseMimeType: 'application/json',
        responseSchema: GEMINI_CV_PROFILE_SCHEMA,
      },
    });

    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      log.warn({ finishReason }, 'CV profile drafting did not finish normally');
      return null;
    }

    if (!response.text) {
      log.warn({ finishReason }, 'CV profile drafting returned no text output');
      return null;
    }

    return JSON.parse(response.text) as CvProfileDraft;
  } catch (err) {
    log.warn({ err }, 'CV profile drafting failed');
    return null;
  }
}
