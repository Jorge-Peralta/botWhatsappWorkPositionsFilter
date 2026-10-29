import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyOcrText } from './ocrPreFilter.js';

const keywordSets = { keywordsEs: ['enfermera'], keywordsEn: [], skillKeywords: [], acronyms: [] };
const clearNonMatchingText = 'Se busca vendedor de ruta con licencia de conducir vigente';

test('enabled filter skips confident OCR text without keywords', () => {
  const result = classifyOcrText({ text: clearNonMatchingText, confidence: 90, keywordSets, keywordFilterEnabled: true });

  assert.equal(result.decision, 'skip');
  assert.equal(result.reason, 'no_keywords_high_confidence');
});

test('enabled filter proceeds on a keyword match and on low-confidence text', () => {
  assert.equal(
    classifyOcrText({ text: 'Se busca enfermera', confidence: 90, keywordSets, keywordFilterEnabled: true }).reason,
    'keyword_match',
  );
  assert.equal(
    classifyOcrText({ text: clearNonMatchingText, confidence: 30, keywordSets, keywordFilterEnabled: true }).reason,
    'low_confidence_or_sparse_text',
  );
});

test('disabled filter always proceeds to vision extraction', () => {
  const result = classifyOcrText({ text: clearNonMatchingText, confidence: 90, keywordSets, keywordFilterEnabled: false });

  assert.equal(result.decision, 'proceed');
  assert.equal(result.reason, 'keyword_filter_disabled');
  assert.equal(result.hasKeyword, false);
  assert.equal(result.text, clearNonMatchingText);
});
