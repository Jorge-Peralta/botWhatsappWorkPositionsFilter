import { config } from '../config.js';
import { getSettings } from '../storage/settingsStore.js';
import { buildExtractionPrompt } from './prompt.js';
import * as anthropicVision from './providers/anthropicVision.js';
import * as geminiVision from './providers/geminiVision.js';
import type { ResizedImage } from './imageResize.js';
import type { ExtractedJobData } from './types.js';

export async function extractWithVision(image: ResizedImage): Promise<ExtractedJobData | null> {
  // Built per call so region edits from the dashboard apply without a restart.
  const prompt = buildExtractionPrompt(getSettings());
  if (config.extractionProvider === 'anthropic') {
    return anthropicVision.extractWithVision(image, prompt);
  }
  return geminiVision.extractWithVision(image, prompt);
}
