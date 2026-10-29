import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildExtractionPrompt } from './prompt.js';

test('extraction prompt names the configured country and language', () => {
  const prompt = buildExtractionPrompt({ country: 'Mexico', language: 'Spanish' });

  assert.match(prompt, /likely in Spanish, from Mexico/);
  assert.ok(!prompt.includes('Honduras'));
});

test('extraction prompt keeps stated gender and age requirements', () => {
  assert.match(buildExtractionPrompt({ country: 'Honduras', language: 'Spanish' }), /gender or age requirement/i);
});

test('extraction prompt omits the region hint when country and language are blank', () => {
  const prompt = buildExtractionPrompt({ country: ' ', language: '' });

  assert.ok(!prompt.includes('likely'));
  assert.match(prompt, /^Extract structured job posting data from this flyer image \(a WhatsApp job listing\)\./);
});
