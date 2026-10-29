// Bilingual (Spanish/English) keyword lists used by the OCR pre-filter to
// decide whether a flyer image is worth sending to the paid vision extraction
// step. The literals below are only the fresh-install seed (an example IT
// profile); the live lists come from the settings table and can describe any
// profession.

export const SPANISH_ROLE_KEYWORDS = [
  'informatica',
  'sistemas',
  'programador',
  'programadora',
  'desarrollador',
  'desarrolladora',
  'soporte tecnico',
  'administrador de sistemas',
  'administradora de sistemas',
  'administrador de redes',
  'administradora de redes',
  'base de datos',
  'ciberseguridad',
];

export const ENGLISH_ROLE_KEYWORDS = [
  'software developer',
  'software engineer',
  'fullstack',
  'full stack',
  'backend',
  'back end',
  'frontend',
  'front end',
  'sysadmin',
  'devops',
  'help desk',
  'technical support',
];

export const SKILL_KEYWORDS = [
  '.net',
  'c#',
  'react',
  'typescript',
  'javascript',
  'node.js',
  'nodejs',
  'sql',
  'python',
  'java',
  'angular',
  'vue',
  'aws',
  'azure',
  'docker',
  'kubernetes',
  'linux',
];

// Short, ambiguous acronyms that must only match as an exact-case whole word
// against the ORIGINAL (unnormalized) text. Lowercase "ti" is the Spanish
// word "you" and lowercase "it" is a common English word, so normalizing
// these the same way as the rest of the list would produce false positives.
export const CASE_SENSITIVE_ACRONYMS = ['TI', 'IT'];

// General entry-level roles that need no specific profession. Not part of the
// editable settings: merged in by keywordSetsFromSettings() only while the
// candidate accepts entry-level jobs in any field.
export const ENTRY_LEVEL_KEYWORDS_ES = [
  'cajero',
  'cajeros',
  'cajera',
  'mesero',
  'meseros',
  'mesera',
  'digitador',
  'digitadora',
  'bodeguero',
  'bodeguera',
  'atencion al cliente',
  'servicio al cliente',
  'vendedor',
  'vendedora',
  'impulsador',
  'impulsadora',
  'ayudante',
  'auxiliar',
  'conserje',
  'limpieza',
  'repartidor',
  'repartidora',
  'empacador',
  'empacadora',
  'recepcionista',
  'operario',
  'operaria',
  'call center',
  'sin experiencia',
  'primer empleo',
  'secundaria completa',
  'secundaria',
  'motorista',
];

export const ENTRY_LEVEL_KEYWORDS_EN = [
  'cashier',
  'customer service',
  'warehouse',
  'sales associate',
  'receptionist',
  'call center',
  'entry level',
  'no experience',
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match using Unicode letter/number classes rather than `\b`,
// since `\b` breaks down around keywords containing non-word characters
// (e.g. "c#", ".net") — a plain `\b` can't anchor immediately after "#".
function buildWordBoundaryRegex(keyword: string, caseSensitive: boolean): RegExp {
  const escaped = escapeRegExp(keyword);
  const flags = caseSensitive ? 'u' : 'iu';
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, flags);
}

export interface KeywordSets {
  keywordsEs: string[];
  keywordsEn: string[];
  skillKeywords: string[];
  acronyms: string[];
}

/**
 * The keyword sets every filter matches against, built from the live settings.
 * Shared by the OCR pre-filter and the post-extraction keyword filter so both
 * always gate on the same list.
 */
export function keywordSetsFromSettings(
  settings: KeywordSets & { acceptEntryLevelAnyField: boolean },
): KeywordSets {
  const withEntryLevel = (keywords: string[], entryLevel: string[]) =>
    settings.acceptEntryLevelAnyField ? [...keywords, ...entryLevel] : keywords;

  return {
    keywordsEs: withEntryLevel(settings.keywordsEs, ENTRY_LEVEL_KEYWORDS_ES),
    keywordsEn: withEntryLevel(settings.keywordsEn, ENTRY_LEVEL_KEYWORDS_EN),
    skillKeywords: settings.skillKeywords,
    acronyms: settings.acronyms,
  };
}

export function containsKeyword(
  rawText: string,
  keywordSets: KeywordSets,
): { matched: boolean; keyword: string | null } {
  const normalized = normalize(rawText);
  const normalizedKeywords = [...keywordSets.keywordsEs, ...keywordSets.keywordsEn, ...keywordSets.skillKeywords];

  for (const keyword of normalizedKeywords) {
    if (buildWordBoundaryRegex(keyword, false).test(normalized)) {
      return { matched: true, keyword };
    }
  }

  for (const acronym of keywordSets.acronyms) {
    if (buildWordBoundaryRegex(acronym, true).test(rawText)) {
      return { matched: true, keyword: acronym };
    }
  }

  return { matched: false, keyword: null };
}
