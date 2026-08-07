import type Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'modelSelector' });

// Cached exactly once per process: the promise itself is assigned
// synchronously before any await happens inside resolveOnce(), so concurrent
// callers that arrive before the first resolution all observe the same
// in-flight promise instead of racing separate capability checks.
let resolvedModelPromise: Promise<string> | null = null;
let warnedOnce = false;

export function resolveExtractionModel(client: Anthropic): Promise<string> {
  if (!resolvedModelPromise) {
    resolvedModelPromise = resolveOnce(client);
  }
  return resolvedModelPromise;
}

async function resolveOnce(client: Anthropic): Promise<string> {
  try {
    const model = await client.models.retrieve(config.extractionModel);
    // `capabilities` can be null on the wire even though the field is typed
    // as ModelCapabilities | null — access defensively regardless.
    const supportsImages = model.capabilities?.image_input?.supported ?? false;

    if (supportsImages) {
      return config.extractionModel;
    }

    warnFallbackOnce('extraction model does not report image-input support; falling back');
    return config.extractionFallbackModel;
  } catch (err) {
    warnFallbackOnce('failed to verify extraction model capabilities; falling back', err);
    return config.extractionFallbackModel;
  }
}

function warnFallbackOnce(message: string, err?: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  log.warn(
    { err, extractionModel: config.extractionModel, fallbackModel: config.extractionFallbackModel },
    message,
  );
}
