// Bilingual (Spanish/English) IT-adjacent keyword list used by the OCR
// pre-filter to decide whether a flyer image is worth sending to the paid
// vision extraction step.

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

export const TECH_KEYWORDS = [
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

export interface ItKeywordSets {
  keywordsEs: string[];
  keywordsEn: string[];
  techKeywords: string[];
  acronyms: string[];
}

export function containsItKeyword(
  rawText: string,
  keywordSets: ItKeywordSets,
): { matched: boolean; keyword: string | null } {
  const normalized = normalize(rawText);
  const normalizedKeywords = [...keywordSets.keywordsEs, ...keywordSets.keywordsEn, ...keywordSets.techKeywords];

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
