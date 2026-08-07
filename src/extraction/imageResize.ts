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
