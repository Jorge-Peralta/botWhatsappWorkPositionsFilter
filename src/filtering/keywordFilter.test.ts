import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { useScratchDb } from '../testSupport/scratchDb.js';
import type { ExtractedJobData } from '../extraction/types.js';

useScratchDb();

let evaluateKeywordFilter: typeof import('./keywordFilter.js').evaluateKeywordFilter;
let updateSettings: typeof import('../storage/settingsStore.js').updateSettings;

before(async () => {
  (await import('../storage/db.js')).initDb();
  ({ evaluateKeywordFilter } = await import('./keywordFilter.js'));
  ({ updateSettings } = await import('../storage/settingsStore.js'));
  updateSettings({ keywordsEs: ['enfermera'], keywordsEn: [], skillKeywords: [], acronyms: [] });
});

const salesFlyer: ExtractedJobData = {
  title: 'Vendedor de ruta',
  company: null,
  location: null,
  requirements: ['licencia de conducir'],
  salary: null,
  contactMethod: null,
};

test('with the filter enabled, a flyer without profile keywords is a non-match', () => {
  updateSettings({ keywordFilterEnabled: true, acceptEntryLevelAnyField: false });

  assert.deepEqual(evaluateKeywordFilter({ extracted: salesFlyer, ocrPreFilterResult: null, caption: null }), {
    keywordMatch: false,
    matchedKeyword: null,
  });
});

test('with entry-level jobs accepted, a general flyer passes the filter via the built-in list', () => {
  updateSettings({ keywordFilterEnabled: true, acceptEntryLevelAnyField: true });

  assert.deepEqual(evaluateKeywordFilter({ extracted: salesFlyer, ocrPreFilterResult: null, caption: null }), {
    keywordMatch: true,
    matchedKeyword: 'vendedor',
  });
});

test('with the filter disabled, the filter abstains so the flyer is kept and scored', () => {
  updateSettings({ keywordFilterEnabled: false });

  assert.deepEqual(evaluateKeywordFilter({ extracted: salesFlyer, ocrPreFilterResult: null, caption: null }), {
    keywordMatch: null,
    matchedKeyword: null,
  });
});
