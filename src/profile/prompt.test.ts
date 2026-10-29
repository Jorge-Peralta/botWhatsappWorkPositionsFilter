import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCvProfilePrompt } from './prompt.js';

const noOptions = { acceptLowerLevelRoles: false };

test('CV prompt targets the configured region and forbids inventing facts', () => {
  const prompt = buildCvProfilePrompt({ country: 'Honduras', language: 'Spanish' }, noOptions);

  assert.match(prompt, /Honduras/);
  assert.match(prompt, /Spanish/);
  assert.match(prompt, /do not invent/i);
  assert.match(prompt, /dealbreakers/i);
});

test('CV prompt still works without a configured region', () => {
  const prompt = buildCvProfilePrompt({ country: '', language: '' }, noOptions);

  assert.ok(!prompt.includes('()'));
  assert.match(prompt, /do not invent/i);
});

test('CV prompt asks for lower-level titles only when the candidate accepts them', () => {
  const region = { country: 'Honduras', language: 'Spanish' };

  assert.match(buildCvProfilePrompt(region, { acceptLowerLevelRoles: true }), /lower-level and assistant titles/i);
  assert.ok(!/lower-level/i.test(buildCvProfilePrompt(region, noOptions)));
});
