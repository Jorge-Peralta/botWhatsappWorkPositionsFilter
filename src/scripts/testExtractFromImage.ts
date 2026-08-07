import 'dotenv/config';
import fs from 'node:fs';
import { logger } from '../logger.js';
import { extractJobData } from '../extraction/extractJobData.js';

/**
 * Test harness for the Phase 2 extraction pipeline (OCR pre-filter + vision
 * extraction) against a local image file, without needing a live WhatsApp
 * message. Mirrors the style of src/scripts/testCaptureFromHistory.ts.
 *
 * Usage: pnpm test:extract <path-to-image>
 */

const log = logger.child({ module: 'testExtractFromImage' });

async function main(): Promise<void> {
  const imagePath = process.argv[2];
  if (!imagePath) {
    log.error('usage: pnpm test:extract <path-to-image>');
    process.exit(1);
  }

  const buffer = fs.readFileSync(imagePath);
  const outcome = await extractJobData({ buffer });

  console.log(JSON.stringify(outcome, null, 2));
  process.exit(0);
}

void main();
