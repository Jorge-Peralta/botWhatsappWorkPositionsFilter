import fs from 'node:fs/promises';
import type { WASocket } from '@whiskeysockets/baileys';
import { config } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'groupDiscovery' });

/**
 * Writes every group this account currently participates in to
 * config.groupsFilePath, so the operator can open one file to find JIDs
 * instead of scrolling past Baileys' connection-log noise (history sync,
 * media re-uploads, etc).
 */
export async function logAllParticipatingGroups(sock: WASocket): Promise<void> {
  const groups = await sock.groupFetchAllParticipating();
  const entries = Object.values(groups)
    .map((group) => ({
      jid: group.id,
      subject: group.subject,
      size: group.participants.length,
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject));

  await fs.writeFile(config.groupsFilePath, JSON.stringify(entries, null, 2), 'utf8');

  log.info(
    { count: entries.length, groupsFilePath: config.groupsFilePath },
    'participating groups discovered — see groupsFilePath for the full list',
  );
}
