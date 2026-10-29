import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CV_BYTES, normalizeDraft, parseCvUpload } from './cvUpload.js';

const toBase64 = (text: string) => Buffer.from(text, 'utf-8').toString('base64');

test('accepts a PDF upload as a base64 document', () => {
  const result = parseCvUpload({ fileName: 'cv.pdf', mimeType: 'application/pdf', dataBase64: toBase64('%PDF-1.7') });

  assert.deepEqual(result, { ok: true, cv: { kind: 'pdf', base64: toBase64('%PDF-1.7') } });
});

test('decodes a plain-text or markdown upload to text', () => {
  assert.deepEqual(
    parseCvUpload({ fileName: 'cv.txt', mimeType: 'text/plain', dataBase64: toBase64('Enfermera, 5 años') }),
    { ok: true, cv: { kind: 'text', text: 'Enfermera, 5 años' } },
  );
  // Browsers often send an empty mime type for .md files; fall back to the extension.
  assert.deepEqual(parseCvUpload({ fileName: 'cv.md', mimeType: '', dataBase64: toBase64('# CV') }), {
    ok: true,
    cv: { kind: 'text', text: '# CV' },
  });
});

test('rejects unsupported file types with a readable error', () => {
  const result = parseCvUpload({
    fileName: 'cv.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    dataBase64: toBase64('x'),
  });

  assert.deepEqual(result, { ok: false, error: 'Unsupported CV format. Upload a PDF, .txt or .md file.' });
});

test('rejects malformed payloads, empty files, and files over the size cap', () => {
  assert.deepEqual(parseCvUpload(null), { ok: false, error: 'Invalid CV upload payload.' });
  assert.deepEqual(parseCvUpload({ fileName: 'cv.pdf', mimeType: 'application/pdf' }), {
    ok: false,
    error: 'Invalid CV upload payload.',
  });
  assert.deepEqual(parseCvUpload({ fileName: 'cv.txt', mimeType: 'text/plain', dataBase64: '' }), {
    ok: false,
    error: 'The CV file is empty.',
  });

  const tooBig = Buffer.alloc(MAX_CV_BYTES + 1).toString('base64');
  assert.deepEqual(parseCvUpload({ fileName: 'cv.pdf', mimeType: 'application/pdf', dataBase64: tooBig }), {
    ok: false,
    error: 'The CV file is larger than 5 MB.',
  });
});

test('normalizeDraft trims, dedupes, and lowercases keywords but keeps acronym case', () => {
  const draft = normalizeDraft({
    profile: '  - Nurse  ',
    keywordsEs: ['Enfermera', 'enfermera ', ''],
    keywordsEn: ['Nurse', 'NURSE'],
    skillKeywords: [' Triage', 'triage'],
    acronyms: ['UCI', 'UCI', ' '],
  });

  assert.deepEqual(draft, {
    profile: '- Nurse',
    keywordsEs: ['enfermera'],
    keywordsEn: ['nurse'],
    skillKeywords: ['triage'],
    acronyms: ['UCI'],
  });
});
