import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelMediaUrl, isMonitoredChat, parseChannelRef } from './channels.js';

test('parses a channel JID', () => {
  assert.deepEqual(parseChannelRef(' 120363000000000000@newsletter '), {
    kind: 'jid',
    jid: '120363000000000000@newsletter',
  });
});

test('parses a channel link and a bare invite code', () => {
  assert.deepEqual(parseChannelRef('https://whatsapp.com/channel/0029VaAbCdEf123'), {
    kind: 'invite',
    code: '0029VaAbCdEf123',
  });
  assert.deepEqual(parseChannelRef('0029VaAbCdEf123'), { kind: 'invite', code: '0029VaAbCdEf123' });
});

test('rejects entries that are not channels', () => {
  assert.equal(parseChannelRef(''), null);
  assert.equal(parseChannelRef('https://example.com/not a channel'), null);
});

test('an unresolved channel and a direct chat are not monitored', () => {
  assert.equal(isMonitoredChat('120363000000000000@newsletter'), false);
  assert.equal(isMonitoredChat('50411111111@s.whatsapp.net'), false);
});

test('builds the channel media URL from directPath, falling back to url', () => {
  assert.equal(channelMediaUrl({ directPath: '/m1/v/t24/abc?x=1' }), 'https://mmg.whatsapp.net/m1/v/t24/abc?x=1');
  assert.equal(channelMediaUrl({ url: 'https://mmg.whatsapp.net/direct' }), 'https://mmg.whatsapp.net/direct');
  assert.equal(channelMediaUrl({}), null);
});
