import sharp from 'sharp';

// dHash (difference hash): resize to 9x8 grayscale pixels, then for each row
// compare each of the first 8 columns to its right neighbor. This yields
// 8 bits per row x 8 rows = 64 bits, encoded as a 16-character hex string.
// Near-identical images (e.g. reposted flyers, recompressed copies) produce
// hashes with a small Hamming distance, unlike cryptographic hashes which
// change completely on any byte difference.
const HASH_WIDTH = 9;
const HASH_HEIGHT = 8;

export async function computeDHash(buffer: Buffer): Promise<string> {
  const { data } = await sharp(buffer)
    .resize(HASH_WIDTH, HASH_HEIGHT, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = '';
  for (let row = 0; row < HASH_HEIGHT; row++) {
    for (let col = 0; col < HASH_WIDTH - 1; col++) {
      const left = data[row * HASH_WIDTH + col] as number;
      const right = data[row * HASH_WIDTH + col + 1] as number;
      bits += left > right ? '1' : '0';
    }
  }

  return bigIntFromBits(bits).toString(16).padStart(16, '0');
}

function bigIntFromBits(bits: string): bigint {
  let value = 0n;
  for (const bit of bits) {
    value = (value << 1n) | BigInt(bit);
  }
  return value;
}

export function hammingDistance(hashA: string, hashB: string): number {
  const a = BigInt(`0x${hashA}`);
  const b = BigInt(`0x${hashB}`);
  let xor = a ^ b;
  let distance = 0;
  while (xor > 0n) {
    distance += Number(xor & 1n);
    xor >>= 1n;
  }
  return distance;
}
