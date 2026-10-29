import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRelevancePrompt } from './prompt.js';
import { RELEVANCE_SCHEMA } from './schema.js';

const profile = '- Registered nurse, 5 years ICU experience';

test('relevance prompt is profession-neutral and embeds the profile', () => {
  const prompt = buildRelevancePrompt({ positive: [], negative: [] }, profile);

  assert.ok(prompt.includes(profile));
  assert.ok(!/stack/i.test(prompt), 'prompt should not assume a tech stack');
  assert.match(prompt, /skills/i);
});

test('relevance schema reasoning description is profession-neutral', () => {
  assert.ok(!/stack/i.test(RELEVANCE_SCHEMA.properties.reasoning.description));
});
