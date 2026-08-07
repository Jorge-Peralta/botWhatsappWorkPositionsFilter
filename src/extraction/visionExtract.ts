import { config } from '../config.js';
import * as anthropicVision from './providers/anthropicVision.js';
import * as geminiVision from './providers/geminiVision.js';
import type { ResizedImage } from './imageResize.js';
import type { ExtractedJobData } from './types.js';

export async function extractWithVision(image: ResizedImage): Promise<ExtractedJobData | null> {
  if (config.extractionProvider === 'anthropic') {
    return anthropicVision.extractWithVision(image);
  }
  return geminiVision.extractWithVision(image);
}
