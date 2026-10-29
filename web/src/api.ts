import type { CvProfileDraft, Job, JobStatus, Settings } from './types.js';

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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // readAsDataURL yields "data:<mime>;base64,<payload>" — keep only the payload.
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function generateProfileFromCv(file: File): Promise<CvProfileDraft> {
  const res = await fetch('/api/profile/from-cv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64: await readFileAsBase64(file) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `failed to generate profile: ${res.status}`);
  }
  return res.json() as Promise<CvProfileDraft>;
}
