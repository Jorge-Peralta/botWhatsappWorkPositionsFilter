/**
 * SAFETY-CRITICAL FILE.
 *
 * This is the ONLY module in the codebase allowed to call `sock.sendMessage`.
 * We use a secondary WhatsApp number in read-only mode against the monitored
 * groups to minimize ban risk — the bot must never post into a group. The
 * functions exported here send debug/status messages to our own number only,
 * and do not accept a caller-supplied JID.
 *
 * Do NOT add a group-send helper anywhere in this codebase. If you need to
 * notify about a job match, extend the self-only senders here — never thread
 * a `jid` parameter through from a caller into `sock.sendMessage`.
 */
import type { WASocket } from '@whiskeysockets/baileys';
import { jidNormalizedUser } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';

const log = logger.child({ module: 'safeSend' });

export type SendDebugToSelf = (text: string) => Promise<void>;
export type SendImageToSelf = (image: Buffer, caption: string) => Promise<void>;

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

export function createSafeSender(sock: WASocket): SendDebugToSelf {
  return async function sendDebugToSelf(text: string): Promise<void> {
    const target = resolveSelfJid(sock);
    await sock.sendMessage(target, { text });
    log.debug({ target }, 'sent debug message to self');
  };
}

export function createSafeImageSender(sock: WASocket): SendImageToSelf {
  return async function sendImageToSelf(image: Buffer, caption: string): Promise<void> {
    const target = resolveSelfJid(sock);
    if (caption.length <= MAX_CAPTION_LENGTH) {
      await sock.sendMessage(target, { image, caption });
    } else {
      await sock.sendMessage(target, { image });
      await sock.sendMessage(target, { text: caption });
    }
    log.debug({ target }, 'sent image message to self');
  };
}
