import type { WASocket, proto } from '@whiskeysockets/baileys';
import { config } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'channels' });

const DEFAULT_MEDIA_HOST = 'mmg.whatsapp.net';

export type ChannelRef = { kind: 'jid'; jid: string } | { kind: 'invite'; code: string };

/**
 * Accepts a channel JID (`...@newsletter`), a channel link
 * (`https://whatsapp.com/channel/<code>`) or a bare invite code.
 */
export function parseChannelRef(entry: string): ChannelRef | null {
  const value = entry.trim();
  if (value.length === 0) return null;
  if (value.endsWith('@newsletter')) return { kind: 'jid', jid: value };

  const linkMatch = value.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/);
  if (linkMatch) return { kind: 'invite', code: linkMatch[1] };
  if (/^[A-Za-z0-9]+$/.test(value)) return { kind: 'invite', code: value };
  return null;
}

// Filled on connect from config.targetChannels; invite links need a server
// lookup before we know their JID.
const monitoredChannelJids = new Set<string>();

export function isMonitoredChat(jid: string): boolean {
  if (jid.endsWith('@g.us')) return config.targetGroupJids.has(jid);
  if (jid.endsWith('@newsletter')) return monitoredChannelJids.has(jid);
  return false;
}

/**
 * Channel media is not end-to-end encrypted, so it has no mediaKey and
 * Baileys' downloadMediaMessage can't decrypt it; it is fetched as-is.
 */
export function channelMediaUrl(media: Pick<proto.Message.IImageMessage, 'url' | 'directPath'>): string | null {
  if (media.directPath) return `https://${DEFAULT_MEDIA_HOST}${media.directPath}`;
  return media.url ?? null;
}

export async function downloadChannelMedia(media: Pick<proto.Message.IImageMessage, 'url' | 'directPath'>): Promise<Buffer> {
  const url = channelMediaUrl(media);
  if (!url) throw new Error('channel media has no url or directPath');

  const response = await fetch(url);
  if (!response.ok) throw new Error(`channel media download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// Baileys types `name` as a string, but newsletterMetadata returns the raw
// server object, where the name sits under thread_metadata.name.text.
function channelName(metadata: unknown): string | undefined {
  const raw = metadata as { name?: unknown; thread_metadata?: { name?: { text?: string } } } | null;
  if (typeof raw?.name === 'string') return raw.name;
  return raw?.thread_metadata?.name?.text;
}

export async function resolveMonitoredChannels(sock: WASocket): Promise<void> {
  for (const entry of config.targetChannels) {
    const ref = parseChannelRef(entry);
    if (!ref) {
      log.warn({ entry }, 'skipping TARGET_CHANNELS entry: not a channel link, invite code or @newsletter JID');
      continue;
    }

    try {
      const metadata =
        ref.kind === 'jid' ? await sock.newsletterMetadata('jid', ref.jid) : await sock.newsletterMetadata('invite', ref.code);
      const jid = metadata?.id ?? (ref.kind === 'jid' ? ref.jid : null);
      if (!jid) {
        log.warn({ entry }, 'channel not found — check the link');
        continue;
      }

      // No live-updates subscription needed: WhatsApp pushes posts from
      // followed channels on its own (verified 2026-10-29).
      monitoredChannelJids.add(jid);
      log.info({ jid, name: channelName(metadata) }, 'monitoring channel');
    } catch (err) {
      log.error({ err, entry }, 'failed to resolve channel');
    }
  }
}
