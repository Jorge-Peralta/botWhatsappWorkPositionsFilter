import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from './api.js';
import type { Settings } from './types.js';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface FormState {
  profile: string;
  threshold: string;
  keywordsEs: string;
  keywordsEn: string;
  skillKeywords: string;
  acronyms: string;
}

function parseListInput(raw: string): string[] {
  return raw
    .split(/,|\n/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);
}

function toFormState(settings: Settings): FormState {
  return {
    profile: settings.profile,
    threshold: String(settings.threshold),
    keywordsEs: settings.keywordsEs.join(', '),
    keywordsEn: settings.keywordsEn.join(', '),
    skillKeywords: settings.skillKeywords.join(', '),
    acronyms: settings.acronyms.join(', '),
  };
}

export default function SettingsPanel() {
  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings()
      .then((settings) => setForm(toFormState(settings)))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'failed to load settings'));
  }, []);

  if (loadError) {
    return <div className="max-w-2xl mx-auto p-6 text-red-600 dark:text-red-400">Failed to load settings: {loadError}</div>;
  }

  if (!form) {
    return <div className="max-w-2xl mx-auto p-6 text-neutral-500">Loading settings…</div>;
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function validate(current: FormState): string | null {
    if (current.profile.trim().length === 0) {
      return 'Profile text cannot be empty.';
    }
    const thresholdNum = Number(current.threshold);
    if (!Number.isFinite(thresholdNum) || thresholdNum < 0 || thresholdNum > 100) {
      return 'Threshold must be a number between 0 and 100.';
    }
    return null;
  }

  async function handleSave() {
    if (!form) return;

    const error = validate(form);
    if (error) {
      setValidationError(error);
      setSaveState('error');
      return;
    }
    setValidationError(null);

    setSaveState('saving');
    try {
      const saved = await updateSettings({
        profile: form.profile,
        threshold: Number(form.threshold),
        keywordsEs: parseListInput(form.keywordsEs),
        keywordsEn: parseListInput(form.keywordsEn),
        skillKeywords: parseListInput(form.skillKeywords),
        acronyms: parseListInput(form.acronyms),
      });
      setForm(toFormState(saved));
      setSaveState('saved');
    } catch (err) {
      console.error(err);
      setSaveState('error');
    }
  }

  const labelClasses = 'block text-sm font-medium mb-1';
  const textareaClasses =
    'w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm font-mono min-h-[120px] shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white';
  const fieldWrapperClasses = 'space-y-1';

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4 overflow-y-auto">
      <div className={fieldWrapperClasses}>
        <label htmlFor="profile" className={labelClasses}>
          Candidate profile
        </label>
        <textarea
          id="profile"
          className={`${textareaClasses} min-h-[160px]`}
          value={form.profile}
          onChange={(e) => updateField('profile', e.target.value)}
        />
      </div>

      <div className={fieldWrapperClasses}>
        <label htmlFor="threshold" className={labelClasses}>
          Notification threshold (0-100)
        </label>
        <input
          id="threshold"
          type="number"
          min={0}
          max={100}
          className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-3 text-sm shadow-sm transition-shadow focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white"
          value={form.threshold}
          onChange={(e) => updateField('threshold', e.target.value)}
        />
      </div>

      <div className={fieldWrapperClasses}>
        <label htmlFor="keywordsEs" className={labelClasses}>
          Spanish role keywords
        </label>
        <textarea
          id="keywordsEs"
          className={textareaClasses}
          value={form.keywordsEs}
          onChange={(e) => updateField('keywordsEs', e.target.value)}
        />
      </div>

      <div className={fieldWrapperClasses}>
        <label htmlFor="keywordsEn" className={labelClasses}>
          English role keywords
        </label>
        <textarea
          id="keywordsEn"
          className={textareaClasses}
          value={form.keywordsEn}
          onChange={(e) => updateField('keywordsEn', e.target.value)}
        />
      </div>

      <div className={fieldWrapperClasses}>
        <label htmlFor="skillKeywords" className={labelClasses}>
          Skill keywords
        </label>
        <textarea
          id="skillKeywords"
          className={textareaClasses}
          value={form.skillKeywords}
          onChange={(e) => updateField('skillKeywords', e.target.value)}
        />
      </div>

      <div className={fieldWrapperClasses}>
        <label htmlFor="acronyms" className={labelClasses}>
          Case-sensitive acronyms
        </label>
        <textarea
          id="acronyms"
          className={textareaClasses}
          value={form.acronyms}
          onChange={(e) => updateField('acronyms', e.target.value)}
        />
      </div>

      {validationError && <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>}

      <div className="flex items-center gap-3">
        <button
          className="rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium shadow-sm hover:opacity-90"
          onClick={() => void handleSave()}
          disabled={saveState === 'saving'}
        >
          Save
        </button>
        {saveState === 'saving' && <span className="text-sm text-neutral-500">Saving…</span>}
        {saveState === 'saved' && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
        {saveState === 'error' && !validationError && (
          <span className="text-sm text-red-600 dark:text-red-400">Failed to save.</span>
        )}
      </div>
    </div>
  );
}
