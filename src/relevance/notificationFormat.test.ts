import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMatchNotification } from './notificationFormat.js';
import type { ExtractedJobData } from '../extraction/types.js';

const extracted = {
  title: 'Enfermera de UCI',
  company: 'Hospital Central',
  location: 'Tegucigalpa',
  salary: 'L 25,000',
  requirements: ['Licencia vigente', '3 años de experiencia'],
  contactMethod: 'rrhh@hospital.hn',
} as ExtractedJobData;
const relevance = { score: 85, reasoning: 'Matches the ICU experience.' };
const imagePath = 'C:\\data\\images\\group\\flyer.jpg';

test('English notification labels every field and lists requirements as bullets', () => {
  const message = formatMatchNotification({ jobId: 12, extracted, relevance, language: 'en' });

  assert.match(message, /^✅ \*New job match\* · 85\/100/);
  assert.match(message, /\*Enfermera de UCI\*/);
  assert.match(message, /🏢 Hospital Central/);
  assert.match(message, /📍 Tegucigalpa/);
  assert.match(message, /💰 L 25,000/);
  assert.match(message, /\*Requirements:\*\n• Licencia vigente\n• 3 años de experiencia/);
  assert.match(message, /\*How to apply:\* rrhh@hospital\.hn/);
  assert.match(message, /\*Why it matches:\* Matches the ICU experience\./);
  assert.match(message, /_Job #12_$/);
});

test('Spanish notification uses Spanish labels', () => {
  const message = formatMatchNotification({ jobId: 12, extracted, relevance, language: 'es' });

  assert.match(message, /^✅ \*Nueva oferta compatible\* · 85\/100/);
  assert.match(message, /\*Requisitos:\*/);
  assert.match(message, /\*Cómo aplicar:\*/);
  assert.match(message, /\*Por qué encaja:\*/);
  assert.match(message, /_Oferta #12_$/);
  assert.ok(!/Requirements|How to apply/.test(message));
});

test('notification no longer contains the image path', () => {
  const message = formatMatchNotification({ jobId: 12, extracted, relevance, language: 'en' });

  assert.ok(!message.includes(imagePath));
  assert.ok(!message.includes('flyer.jpg'));
});

test('missing fields are omitted and missing title/company fall back per language', () => {
  const sparse = { ...extracted, title: null, company: null, location: null, salary: null, requirements: [], contactMethod: null };

  const en = formatMatchNotification({ jobId: 3, extracted: sparse, relevance, language: 'en' });
  assert.match(en, /\*\(no title\)\*/);
  assert.match(en, /🏢 \(no company\)/);
  assert.ok(!/📍|💰|Requirements|How to apply/.test(en));

  const es = formatMatchNotification({ jobId: 3, extracted: sparse, relevance, language: 'es' });
  assert.match(es, /\*\(sin título\)\*/);
  assert.match(es, /🏢 \(sin empresa\)/);
});

test('only the first five requirements are listed', () => {
  const many = { ...extracted, requirements: ['a', 'b', 'c', 'd', 'e', 'f'] };
  const message = formatMatchNotification({ jobId: 1, extracted: many, relevance, language: 'en' });

  assert.equal((message.match(/^• /gm) ?? []).length, 5);
  assert.ok(!message.includes('• f'));
});
