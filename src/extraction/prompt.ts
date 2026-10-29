import type { JobRegion } from '../storage/settingsStore.js';

// "likely in Spanish, from Honduras" — built from the configured region so the
// wording stays identical between the extraction and relevance prompts. Empty
// when neither value is set.
export function describeRegion(region: JobRegion): string {
  const language = region.language.trim();
  const country = region.country.trim();
  const parts = [language ? `likely in ${language}` : null, country ? `from ${country}` : null].filter(
    (part) => part !== null,
  );
  return parts.join(', ');
}

// Shared vision-extraction prompt, used by every provider (Anthropic, Gemini,
// ...) so the wording never silently drifts between implementations.
export function buildExtractionPrompt(region: JobRegion): string {
  const regionHint = describeRegion(region);
  return (
    `Extract structured job posting data from this flyer image (a WhatsApp job listing${regionHint ? `, ${regionHint}` : ''}). ` +
    'Use null for any field not present in the image; use an empty array if no requirements ' +
    'are listed. Keep extracted text in its original language — do not translate.'
  );
}
