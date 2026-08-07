import 'dotenv/config';
import type { WAMessage } from '@whiskeysockets/baileys';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { startConnection } from '../whatsapp/connection.js';
import { captureImageIfMatch, extractImageMessage } from '../whatsapp/messageHandler.js';

/**
 * Test harness for the image-capture pipeline that doesn't require anyone to
 * post a fresh message into a monitored group. WhatsApp pushes each linked
 * device's recent chat history once, right after pairing, via the
 * 'messaging-history.set' event — this script listens for that sync, picks
 * the most recent image message from a target group, and runs it through the
 * exact same capture path as a live message.
 *
 * IMPORTANT: this only works if a history sync actually fires. WhatsApp
 * performs the full sync once, right after the QR/pairing-code link — it
 * does not replay on ordinary reconnects with a persisted session. If this
 * script times out with "no history sync received", delete data/auth and
 * re-run `pnpm dev` to re-pair, then run this script on that same run (or
 * immediately after).
 */

const log = logger.child({ module: 'testCaptureFromHistory' });
const HISTORY_SYNC_TIMEOUT_MS = 45_000;

// Baileys uses Long for some numeric fields depending on build.
type Long = { toNumber(): number };
function toPlainNumber(value: number | Long | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return 0;
}

async function main(): Promise<void> {
  if (config.targetGroupJids.size === 0) {
    log.error('TARGET_GROUP_JIDS is empty in .env — whitelist at least one group before running this script');
    process.exit(1);
  }

  const sock = await startConnection();

  let best: WAMessage | null = null;
  let bestTimestamp = -Infinity;
  let sawAnySync = false;
  let finished = false;

  const finish = async (): Promise<void> => {
    if (finished) return;
    finished = true;

    if (!best) {
      log.error(
        { sawAnySync },
        sawAnySync
          ? 'history sync completed but no image messages were found in the whitelisted groups — try a group with a more recent flyer, or fall back to a live test message'
          : 'no history sync received within the timeout — this only fires once, right after pairing; delete data/auth and re-run `pnpm dev` to re-pair, then run this script',
      );
      process.exit(1);
    }

    log.info(
      { groupJid: best.key.remoteJid, messageId: best.key.id },
      'found latest image in synced history — capturing',
    );
    const captured = await captureImageIfMatch(sock, best);
    log.info({ captured }, captured ? 'test capture succeeded — check data/images/<jid>/' : 'capture failed');
    process.exit(captured ? 0 : 1);
  };

  sock.ev.on('messaging-history.set', ({ messages, isLatest }) => {
    sawAnySync = true;

    for (const msg of messages) {
      const remoteJid = msg.key.remoteJid;
      if (!remoteJid || !config.targetGroupJids.has(remoteJid)) continue;
      if (!extractImageMessage(msg)) continue;

      const timestamp = toPlainNumber(msg.messageTimestamp);
      if (timestamp > bestTimestamp) {
        best = msg;
        bestTimestamp = timestamp;
      }
    }

    if (isLatest) void finish();
  });

  setTimeout(() => void finish(), HISTORY_SYNC_TIMEOUT_MS);
}

void main();
