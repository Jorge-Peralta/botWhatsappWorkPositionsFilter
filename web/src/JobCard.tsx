import type { Job } from './types.js';
import { scoreBadgeClasses, scoreBadgeLabel } from './scoreBadge.js';

export default function JobCard({
  job,
  selected,
  onClick,
}: {
  job: Job;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`mb-4 block w-full break-inside-avoid overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900${
        selected
          ? ' scale-[1.02] ring-2 ring-neutral-900 ring-offset-2 ring-offset-neutral-50 dark:ring-white dark:ring-offset-neutral-950'
          : ''
      }`}
      onClick={onClick}
    >
      <div className="relative">
        <img
          src={job.image_url}
          alt={job.extracted?.title ?? 'job flyer'}
          loading="lazy"
          className="h-auto w-full bg-neutral-100 dark:bg-neutral-800"
        />
        <span className={`absolute top-2 right-2 ${scoreBadgeClasses(job.relevance_score)}`}>
          {scoreBadgeLabel(job.relevance_score)}
        </span>
      </div>
      <div className="p-2.5">
        <p className="truncate text-sm font-semibold">{job.extracted?.title ?? '(no title)'}</p>
        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
          {job.extracted?.company ?? '(no company)'}
        </p>
      </div>
    </button>
  );
}
