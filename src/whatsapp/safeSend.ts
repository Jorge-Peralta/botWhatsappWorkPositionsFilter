/**
 * SAFETY-CRITICAL FILE.
 *
 * This is the ONLY module in the codebase allowed to call `sock.sendMessage`.
 * We use a secondary WhatsApp number in read-only mode against the monitored
 * groups to minimize ban risk — the bot must never post into a group. Debug
 * messages go to our own number only. Match notifications go to our own number
 * plus the extra phone numbers the candidate lists in the dashboard settings.
 *
 * No caller ever supplies a JID: extra recipients come in as phone numbers and
 * the JID is built here, after the number is reduced to digits only, so a group
 * JID (or any other non-phone value) can't reach `sock.sendMessage`.
 *
 * Do NOT add a group-send helper anywhere in this codebase, and never thread a
 * `jid` parameter through from a caller into `sock.sendMessage`.
 */
import type { WASocket } from '@whiskeysockets/baileys';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { normalizePhoneNumber, toUserJid } from './phoneNumber.js';

const log = logger.child({ module: 'safeSend' });

export type SendDebugToSelf = (text: string) => Promise<void>;
export type SendImageToRecipients = (image: Buffer, caption: string) => Promise<void>;

// WhatsApp truncates longer image captions; past this the text is sent as a
// separate message right after the image.
export const MAX_CAPTION_LENGTH = 1024;

function resolveSelfJid(sock: WASocket): string {
  if (!sock.user?.id) {
    throw new Error('safeSend: cannot resolve own JID — socket has no authenticated user yet');
  }

  const target = jidNormalizedUser(sock.user.id);

  // Belt-and-suspenders: even though `target` is derived exclusively from
  // sock.user.id (never from caller input), refuse to send to anything
  // that looks like a group JID.
  if (target.endsWith('@g.us')) {
    throw new Error('safeSend: refusing to send — resolved target looks like a group JID');
  }
  return target;
}

// Settings are validated on save, but they are re-checked here so this file
// stays the single gate: invalid entries, duplicates and our own number are
// dropped instead of sent.
function resolveExtraJids(selfJid: string, extraNumbers: readonly string[]): string[] {
  const jids: string[] = [];
  for (const raw of extraNumbers) {
    const digits = normalizePhoneNumber(raw);
    if (digits === null) {
      log.warn('skipping extra notification number: not a valid phone number');
      continue;
    }
    const jid = toUserJid(digits);
    if (jid !== selfJid && !jids.includes(jid)) jids.push(jid);
  }
  return jids;
}

async function sendImage(sock: WASocket, target: string, image: Buffer, caption: string): Promise<void> {
  if (caption.length <= MAX_CAPTION_LENGTH) {
    await sock.sendMessage(target, { image, caption });
  } else {
    await sock.sendMessage(target, { image });
    await sock.sendMessage(target, { text: caption });
  }
}

export function createSafeSender(sock: WASocket): SendDebugToSelf {
  return async function sendDebugToSelf(text: string): Promise<void> {
    const target = resolveSelfJid(sock);
    await sock.sendMessage(target, { text });
    log.debug({ target }, 'sent debug message to self');
  };
}

/**
 * Sends to our own number first; a failure there rejects, so the caller does
 * not mark the job as notified. Extra recipients are best effort: one failing
 * is logged and the rest still get the message.
 */
export function createSafeImageSender(sock: WASocket, extraNumbers: readonly string[] = []): SendImageToRecipients {
  return async function sendImageToRecipients(image: Buffer, caption: string): Promise<void> {
    const selfJid = resolveSelfJid(sock);
    await sendImage(sock, selfJid, image, caption);
    log.debug({ target: selfJid }, 'sent image message to self');

    for (const target of resolveExtraJids(selfJid, extraNumbers)) {
      try {
        await sendImage(sock, target, image, caption);
        log.debug({ target }, 'sent image message to extra recipient');
      } catch (err) {
        log.error({ err, target }, 'failed to send image message to extra recipient');
      }
    }
  };
}
