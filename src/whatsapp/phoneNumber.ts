// E.164 allows up to 15 digits; anything shorter than 8 can't carry a country
// code plus a subscriber number.
const PHONE_DIGITS_PATTERN = /^\d{8,15}$/;

// Only spacing and the usual punctuation are stripped. Anything else — an `@`,
// letters — makes the entry invalid, so a group or user JID can never pass.
const FORMATTING_CHARACTERS = /[\s+\-().]/g;

/** Returns the digits-only form of `raw`, or null if it isn't a phone number. */
export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(FORMATTING_CHARACTERS, '');
  return PHONE_DIGITS_PATTERN.test(digits) ? digits : null;
}

/** Normalizes and de-duplicates `raws`; returns null if any entry is invalid. */
export function normalizePhoneNumbers(raws: readonly string[]): string[] | null {
  const normalized: string[] = [];
  for (const raw of raws) {
    const digits = normalizePhoneNumber(raw);
    if (digits === null) return null;
    if (!normalized.includes(digits)) normalized.push(digits);
  }
  return normalized;
}

export function toUserJid(digits: string): string {
  return `${digits}@s.whatsapp.net`;
}
