import { useEffect, useState } from 'react';
import { fetchJobs, updateJobStatus } from './api.js';
import JobCard from './JobCard.js';
import DetailPanel from './DetailPanel.js';
import SettingsPanel from './SettingsPanel.js';
import type { Job, JobStatus } from './types.js';

const SKELETON_HEIGHTS = ['h-40', 'h-56', 'h-72'];

const TABS: { label: string; status: JobStatus }[] = [
  { label: 'New', status: 'new' },
  { label: 'Reviewed', status: 'reviewed' },
  { label: 'Applied', status: 'applied' },
  { label: 'Discarded', status: 'discarded' },
];

export default function App() {
  const [status, setStatus] = useState<JobStatus>('new');
  const [view, setView] = useState<'jobs' | 'settings'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  function reload() {
    setLoading(true);
    fetchJobs(status)
      .then(setJobs)
      .catch((err: unknown) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    setSelectedId(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const selectedJob = jobs.find((job) => job.id === selectedId) ?? null;

  async function handleStatusChange(id: number, newStatus: JobStatus) {
    await updateJobStatus(id, newStatus);
    reload();
  }

  const tabBaseClasses = 'px-4 py-2 rounded-full text-sm font-medium transition-colors';
  const tabActiveClasses = 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900';
  const tabInactiveClasses =
    'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800';

  return (
    <div className="flex h-dvh flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
      <div className="flex gap-1 px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        {TABS.map((tab) => (
          <button
            key={tab.status}
            className={`${tabBaseClasses} ${status === tab.status && view === 'jobs' ? tabActiveClasses : tabInactiveClasses}`}
            onClick={() => {
              setStatus(tab.status);
              setView('jobs');
            }}
          >
            {tab.label}
          </button>
        ))}
        <button
          className={`${tabBaseClasses} ml-auto ${view === 'settings' ? tabActiveClasses : tabInactiveClasses}`}
          onClick={() => setView('settings')}
        >
          Settings
        </button>
      </div>

      {view === 'jobs' ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-7xl mx-auto">
              {!loading && (
                <div className="mb-3 text-sm text-neutral-500 dark:text-neutral-400">
                  {jobs.length} job{jobs.length !== 1 ? 's' : ''}
                </div>
              )}

              {loading && (
                <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className={`mb-4 animate-pulse break-inside-avoid rounded-xl bg-neutral-200 dark:bg-neutral-800 ${
                        SKELETON_HEIGHTS[i % SKELETON_HEIGHTS.length]
                      }`}
                    />
                  ))}
                </div>
              )}

              {!loading && jobs.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-20 text-center text-neutral-500 dark:text-neutral-400">
                  <span className="text-3xl">📭</span>
                  <p className="text-sm">No jobs in this status.</p>
                </div>
              )}

              {!loading && jobs.length > 0 && (
                <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 xl:columns-5">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      selected={job.id === selectedId}
                      onClick={() => setSelectedId(job.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {selectedJob && (
            <DetailPanel
              job={selectedJob}
              onStatusChange={(newStatus) => handleStatusChange(selectedJob.id, newStatus)}
              onClose={() => setSelectedId(null)}
            />
          )}
        </div>
      ) : (
        <SettingsPanel />
      )}
    </div>
  );
}
