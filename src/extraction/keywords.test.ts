import { test } from 'node:test';
import assert from 'node:assert/strict';
import { containsKeyword, keywordSetsFromSettings, type KeywordSets } from './keywords.js';

const nonTechSets: KeywordSets = {
  keywordsEs: ['enfermera', 'contador'],
  keywordsEn: ['nurse', 'accountant'],
  skillKeywords: ['excel', 'quickbooks'],
  acronyms: ['RRHH'],
};

test('matches a non-tech role keyword, ignoring accents and case', () => {
  assert.deepEqual(containsKeyword('Se busca ENFERMERÁ con experiencia', nonTechSets), {
    matched: true,
    keyword: 'enfermera',
  });
});

test('matches a skill keyword', () => {
  assert.deepEqual(containsKeyword('Manejo de QuickBooks', nonTechSets), { matched: true, keyword: 'quickbooks' });
});

test('acronyms still only match exact case', () => {
  assert.deepEqual(containsKeyword('Departamento de RRHH', nonTechSets), { matched: true, keyword: 'RRHH' });
  assert.deepEqual(containsKeyword('departamento de rrhh', nonTechSets), { matched: false, keyword: null });
});

test('returns no match when nothing in the text matches', () => {
  assert.deepEqual(containsKeyword('Vendedor de ruta', nonTechSets), { matched: false, keyword: null });
});

test('entry-level keywords are only added when the any-field entry-level switch is on', () => {
  const base = {
    keywordsEs: ['enfermera'],
    keywordsEn: ['nurse'],
    skillKeywords: [],
    acronyms: [],
    acceptEntryLevelAnyField: false,
  };

  assert.deepEqual(containsKeyword('Se busca cajera', keywordSetsFromSettings(base)), { matched: false, keyword: null });
  assert.deepEqual(containsKeyword('Se busca cajera', keywordSetsFromSettings({ ...base, acceptEntryLevelAnyField: true })), {
    matched: true,
    keyword: 'cajera',
  });
  assert.equal(containsKeyword('Entry level warehouse job', keywordSetsFromSettings({ ...base, acceptEntryLevelAnyField: true })).matched, true);
});
