// Shared vision-extraction prompt, used by every provider (Anthropic, Gemini,
// ...) so the wording never silently drifts between implementations.
export const EXTRACTION_PROMPT =
  'Extract structured job posting data from this flyer image (a WhatsApp job listing, likely in Spanish, ' +
  'from Honduras). Use null for any field not present in the image; use an empty array if no requirements ' +
  'are listed. Keep extracted text in its original language — do not translate.';
