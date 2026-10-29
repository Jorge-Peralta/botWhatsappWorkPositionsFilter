import sharp from 'sharp';
import { config } from '../config.js';

export interface ResizedImage {
  base64: string;
  mediaType: 'image/jpeg';
}

export async function resizeForVision(buffer: Buffer): Promise<ResizedImage> {
  const resized = await sharp(buffer)
    .resize({
      width: config.maxImageLongEdge,
      height: config.maxImageLongEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82 })
    .toBuffer();

  return { base64: resized.toString('base64'), mediaType: 'image/jpeg' };
}

// Tesseract reads small flyer text far better once it is enlarged; WhatsApp
// usually delivers ~1280px images. Larger photos are capped to keep OCR fast.
export const OCR_LONG_EDGE = 2400;

/**
 * Cleans a flyer for OCR: honors EXIF orientation, drops colored backgrounds,
 * stretches contrast and sharpens stylized fonts. PNG avoids reintroducing
 * JPEG artifacts around the sharpened edges.
 */
export async function preprocessForOcr(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize({ width: OCR_LONG_EDGE, height: OCR_LONG_EDGE, fit: 'inside' })
    .grayscale()
    .normalize()
    .sharpen()
    .toColourspace('b-w')
    .png()
    .toBuffer();
}
