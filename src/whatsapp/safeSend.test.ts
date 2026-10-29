import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WASocket } from '@whiskeysockets/baileys';
import { createSafeImageSender } from './safeSend.js';

const SELF_JID = '50411111111@s.whatsapp.net';

function fakeSocket(failFor: Set<string> = new Set()) {
  const sentTo: string[] = [];
  const sock = {
    user: { id: '50411111111:7@s.whatsapp.net' },
    sendMessage: async (jid: string) => {
      if (failFor.has(jid)) throw new Error(`send failed for ${jid}`);
      sentTo.push(jid);
      return undefined;
    },
  } as unknown as WASocket;
  return { sock, sentTo };
}

const image = Buffer.from('flyer');

test('sends to self only when there are no extra numbers', async () => {
  const { sock, sentTo } = fakeSocket();
  await createSafeImageSender(sock)(image, 'caption');
  assert.deepEqual(sentTo, [SELF_JID]);
});

test('sends to self first, then to each extra number', async () => {
  const { sock, sentTo } = fakeSocket();
  await createSafeImageSender(sock, ['50422222222', '50433333333'])(image, 'caption');
  assert.deepEqual(sentTo, [SELF_JID, '50422222222@s.whatsapp.net', '50433333333@s.whatsapp.net']);
});

test('skips extra numbers that are invalid, duplicated or the bot itself', async () => {
  const { sock, sentTo } = fakeSocket();
  await createSafeImageSender(sock, [
    '120363000000000000@g.us',
    '50411111111',
    '50422222222',
    '+504 2222-2222',
  ])(image, 'caption');
  assert.deepEqual(sentTo, [SELF_JID, '50422222222@s.whatsapp.net']);
});

test('a failing extra recipient does not stop the others', async () => {
  const { sock, sentTo } = fakeSocket(new Set(['50422222222@s.whatsapp.net']));
  await createSafeImageSender(sock, ['50422222222', '50433333333'])(image, 'caption');
  assert.deepEqual(sentTo, [SELF_JID, '50433333333@s.whatsapp.net']);
});

test('a failing self-send still rejects so the job is not marked notified', async () => {
  const { sock } = fakeSocket(new Set([SELF_JID]));
  await assert.rejects(createSafeImageSender(sock, ['50422222222'])(image, 'caption'));
});

test('a long caption is sent as a separate text message to every recipient', async () => {
  const { sock, sentTo } = fakeSocket();
  await createSafeImageSender(sock, ['50422222222'])(image, 'x'.repeat(2000));
  assert.deepEqual(sentTo, [
    SELF_JID,
    SELF_JID,
    '50422222222@s.whatsapp.net',
    '50422222222@s.whatsapp.net',
  ]);
});
