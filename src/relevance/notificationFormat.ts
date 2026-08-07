import type { ExtractedJobData } from '../extraction/types.js';
import type { RelevanceScore } from './types.js';

export function formatMatchNotification(input: {
  jobId: number;
  extracted: ExtractedJobData;
  relevance: RelevanceScore;
  imagePath: string;
}): string {
  const { jobId, extracted, relevance, imagePath } = input;
  const lines = [
    `New job match — ${relevance.score}/100`,
    `${extracted.title ?? '(no title)'} — ${extracted.company ?? '(no company)'}`,
    extracted.location ? `Location: ${extracted.location}` : null,
    extracted.salary ? `Salary: ${extracted.salary}` : null,
    extracted.requirements.length ? `Requirements: ${extracted.requirements.slice(0, 5).join(', ')}` : null,
    extracted.contactMethod ? `Apply: ${extracted.contactMethod}` : null,
    `Why: ${relevance.reasoning}`,
    `(job #${jobId} — ${imagePath})`,
  ];
  return lines.filter((line) => line !== null).join('\n');
}
