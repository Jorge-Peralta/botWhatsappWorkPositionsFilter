import type { Job, JobStatus } from './types.js';
import { scoreBadgeClasses, scoreBadgeLabel } from './scoreBadge.js';

export default function DetailPanel({
  job,
  onStatusChange,
  onClose,
}: {
  job: Job;
  onStatusChange: (status: JobStatus) => void;
  onClose: () => void;
}) {
  const extracted = job.extracted;

  const actionBaseClasses = 'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors';
  const reviewedClasses =
    'border-neutral-300 text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800';
  const appliedClasses =
    'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950';
  const discardedClasses =
    'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950';

  const labelClasses = 'block text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-0.5';
  const rowClasses = 'mb-3 text-sm';

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-white dark:bg-neutral-900 p-4 overflow-y-auto md:static md:inset-auto md:z-auto md:flex md:w-[420px] md:flex-col md:border-l md:border-neutral-200 dark:md:border-neutral-800 md:bg-white dark:md:bg-neutral-900 md:p-4 md:overflow-y-auto">
      <button className="mb-3 text-sm font-medium text-neutral-600 dark:text-neutral-400 md:hidden" onClick={onClose}>
        ← Back
      </button>

      <div className="relative mb-4">
        <img src={job.image_url} alt={extracted?.title ?? 'job flyer'} className="w-full rounded-xl" />
        <span className={`absolute top-2 right-2 ${scoreBadgeClasses(job.relevance_score)}`}>
          {scoreBadgeLabel(job.relevance_score)}
        </span>
      </div>

      <div className="flex gap-2 mb-4">
        <button className={`${actionBaseClasses} ${reviewedClasses}`} onClick={() => onStatusChange('reviewed')}>
          Mark Reviewed
        </button>
        <button className={`${actionBaseClasses} ${appliedClasses}`} onClick={() => onStatusChange('applied')}>
          Mark Applied
        </button>
        <button className={`${actionBaseClasses} ${discardedClasses}`} onClick={() => onStatusChange('discarded')}>
          Mark Discarded
        </button>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-4">
        <div className={rowClasses}>
          <strong className={labelClasses}>Title</strong>
          {extracted?.title ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Company</strong>
          {extracted?.company ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Location</strong>
          {extracted?.location ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Requirements</strong>
          {extracted && extracted.requirements.length > 0 ? extracted.requirements.join(', ') : '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Salary</strong>
          {extracted?.salary ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Contact method</strong>
          {extracted?.contactMethod ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Relevance score</strong>
          {job.relevance_score ?? '(not scored)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Relevance reasoning</strong>
          {job.relevance_reasoning ?? '(none)'}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Status</strong>
          {job.status}
        </div>
        <div className={rowClasses}>
          <strong className={labelClasses}>Captured at</strong>
          {job.created_at}
        </div>
      </div>
    </div>
  );
}
