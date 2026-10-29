import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, normalizePhoneNumbers } from './phoneNumber.js';

test('normalizePhoneNumber strips formatting down to digits', () => {
  assert.equal(normalizePhoneNumber('+504 9999-8888'), '50499998888');
  assert.equal(normalizePhoneNumber(' (504) 9999 8888 '), '50499998888');
  assert.equal(normalizePhoneNumber('50499998888'), '50499998888');
});

test('normalizePhoneNumber rejects JIDs, letters and wrong lengths', () => {
  assert.equal(normalizePhoneNumber('120363000000000000@g.us'), null);
  assert.equal(normalizePhoneNumber('50499998888@s.whatsapp.net'), null);
  assert.equal(normalizePhoneNumber('abc'), null);
  assert.equal(normalizePhoneNumber('1234567'), null);
  assert.equal(normalizePhoneNumber('1234567890123456'), null);
  assert.equal(normalizePhoneNumber(''), null);
});

test('normalizePhoneNumbers drops duplicates after normalizing', () => {
  assert.deepEqual(normalizePhoneNumbers(['+504 9999-8888', '50499998888', '50433334444']), [
    '50499998888',
    '50433334444',
  ]);
});

test('normalizePhoneNumbers returns null when any entry is invalid', () => {
  assert.equal(normalizePhoneNumbers(['50499998888', 'not a number']), null);
});
