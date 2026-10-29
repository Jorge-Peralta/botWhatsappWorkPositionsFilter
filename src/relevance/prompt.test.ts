import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRelevancePrompt, type RelevanceCandidate } from './prompt.js';
import { RELEVANCE_SCHEMA } from './schema.js';

const noExamples = { positive: [], negative: [] };
const candidate: RelevanceCandidate = {
  profile: '- Registered nurse, 5 years ICU experience',
  country: 'Guatemala',
  language: 'Spanish',
  candidateGender: 'unspecified',
  acceptLowerLevelRoles: false,
  acceptEntryLevelAnyField: false,
};

test('relevance prompt is profession-neutral and embeds the profile', () => {
  const prompt = buildRelevancePrompt(noExamples, candidate);

  assert.ok(prompt.includes(candidate.profile));
  assert.ok(!/stack/i.test(prompt), 'prompt should not assume a tech stack');
  assert.match(prompt, /skills/i);
});

test('relevance prompt names the configured region instead of a hardcoded one', () => {
  const prompt = buildRelevancePrompt(noExamples, candidate);

  assert.match(prompt, /likely in Spanish, from Guatemala/);
  assert.ok(!prompt.includes('Honduras'));
});

test('a set candidate gender tells the scorer to penalize flyers requiring a different gender', () => {
  const prompt = buildRelevancePrompt(noExamples, { ...candidate, candidateGender: 'female' });

  assert.match(prompt, /candidate's gender: female/i);
  assert.match(prompt, /explicitly requires a different gender/i);
});

test('an unspecified candidate gender adds no gender instruction', () => {
  assert.ok(!/gender/i.test(buildRelevancePrompt(noExamples, candidate)));
});

test('lower-level switch removes the overqualification penalty', () => {
  assert.match(buildRelevancePrompt(noExamples, { ...candidate, acceptLowerLevelRoles: true }), /overqualification/i);
});

test('entry-level switch accepts general jobs from any field', () => {
  assert.match(buildRelevancePrompt(noExamples, { ...candidate, acceptEntryLevelAnyField: true }), /entry-level jobs in any field/i);
});

test('with both switches off, no lower-qualification rules are added', () => {
  const prompt = buildRelevancePrompt(noExamples, candidate);

  assert.ok(!/overqualification/i.test(prompt));
  assert.ok(!/entry-level/i.test(prompt));
});

test('relevance schema reasoning description is profession-neutral', () => {
  assert.ok(!/stack/i.test(RELEVANCE_SCHEMA.properties.reasoning.description));
});
