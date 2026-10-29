import type { ExtractedJobData } from '../extraction/types.js';
import type { NotificationLanguage } from '../storage/settingsStore.js';
import type { RelevanceScore } from './types.js';

const LABELS: Record<
  NotificationLanguage,
  { header: string; noTitle: string; noCompany: string; requirements: string; apply: string; why: string; job: string }
> = {
  en: {
    header: 'New job match',
    noTitle: '(no title)',
    noCompany: '(no company)',
    requirements: 'Requirements',
    apply: 'How to apply',
    why: 'Why it matches',
    job: 'Job',
  },
  es: {
    header: 'Nueva oferta compatible',
    noTitle: '(sin título)',
    noCompany: '(sin empresa)',
    requirements: 'Requisitos',
    apply: 'Cómo aplicar',
    why: 'Por qué encaja',
    job: 'Oferta',
  },
};

const MAX_REQUIREMENTS = 5;

/**
 * Builds the match notification text, using WhatsApp formatting (*bold*,
 * _italic_). It is sent as the caption of the flyer image itself.
 */
export function formatMatchNotification(input: {
  jobId: number;
  extracted: ExtractedJobData;
  relevance: RelevanceScore;
  language: NotificationLanguage;
}): string {
  const { jobId, extracted, relevance, language } = input;
  const labels = LABELS[language];
  const requirements = extracted.requirements.slice(0, MAX_REQUIREMENTS);

  const sections = [
    `✅ *${labels.header}* · ${relevance.score}/100`,
    [
      `*${extracted.title ?? labels.noTitle}*`,
      `🏢 ${extracted.company ?? labels.noCompany}`,
      extracted.location ? `📍 ${extracted.location}` : null,
      extracted.salary ? `💰 ${extracted.salary}` : null,
    ]
      .filter((line) => line !== null)
      .join('\n'),
    requirements.length
      ? `📋 *${labels.requirements}:*\n${requirements.map((requirement) => `• ${requirement}`).join('\n')}`
      : null,
    extracted.contactMethod ? `📞 *${labels.apply}:* ${extracted.contactMethod}` : null,
    `💡 *${labels.why}:* ${relevance.reasoning}`,
    `_${labels.job} #${jobId}_`,
  ];
  return sections.filter((section) => section !== null).join('\n\n');
}
