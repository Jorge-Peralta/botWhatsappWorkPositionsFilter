import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCvProfilePrompt } from './prompt.js';

test('CV prompt targets the configured region and forbids inventing facts', () => {
  const prompt = buildCvProfilePrompt({ country: 'Honduras', language: 'Spanish' });

  assert.match(prompt, /Honduras/);
  assert.match(prompt, /Spanish/);
  assert.match(prompt, /do not invent/i);
  assert.match(prompt, /dealbreakers/i);
});

test('CV prompt still works without a configured region', () => {
  const prompt = buildCvProfilePrompt({ country: '', language: '' });

  assert.ok(!prompt.includes('()'));
  assert.match(prompt, /do not invent/i);
});
