import type { Job, JobStatus, Settings } from './types.js';

export async function fetchJobs(status: JobStatus): Promise<Job[]> {
  const res = await fetch(`/api/jobs?status=${encodeURIComponent(status)}`);
  if (!res.ok) throw new Error(`failed to fetch jobs: ${res.status}`);
  return res.json() as Promise<Job[]>;
}

export async function updateJobStatus(id: number, status: JobStatus): Promise<Job> {
  const res = await fetch(`/api/jobs/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`failed to update job ${id}: ${res.status}`);
  return res.json() as Promise<Job>;
}

export async function fetchSettings(): Promise<Settings> {
  const res = await fetch('/api/settings');
  if (!res.ok) throw new Error(`failed to fetch settings: ${res.status}`);
  return res.json() as Promise<Settings>;
}

export async function updateSettings(settings: Settings): Promise<Settings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error(`failed to update settings: ${res.status}`);
  return res.json() as Promise<Settings>;
}
