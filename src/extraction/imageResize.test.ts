import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { OCR_LONG_EDGE, preprocessForOcr } from './imageResize.js';

function solidImage(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } })
    .jpeg()
    .toBuffer();
}

test('OCR preprocessing returns a single-channel PNG', async () => {
  const output = await preprocessForOcr(await solidImage(800, 600));
  const meta = await sharp(output).metadata();

  assert.equal(meta.format, 'png');
  assert.equal(meta.channels, 1);
});

test('OCR preprocessing scales the long edge to the OCR size, keeping aspect ratio', async () => {
  const upscaled = await sharp(await preprocessForOcr(await solidImage(800, 600))).metadata();
  assert.equal(upscaled.width, OCR_LONG_EDGE);
  assert.equal(upscaled.height, OCR_LONG_EDGE * 0.75);

  const downscaled = await sharp(await preprocessForOcr(await solidImage(1500, 4000))).metadata();
  assert.equal(downscaled.height, OCR_LONG_EDGE);
});
