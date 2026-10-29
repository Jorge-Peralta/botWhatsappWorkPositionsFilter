import type { WAMessage, WASocket } from '@whiskeysockets/baileys';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { logger } from '../logger.js';
import { downloadChannelMedia, isMonitoredChat } from './channels.js';
import * as imageStore from '../storage/imageStore.js';
import * as jobStore from '../storage/jobStore.js';
import { extractJobData } from '../extraction/extractJobData.js';
import type { ExtractionOutcome } from '../extraction/types.js';
import { computeDHash } from '../dedup/imageHash.js';
import { evaluateKeywordFilter } from '../filtering/keywordFilter.js';
import { createSafeImageSender } from './safeSend.js';
import { scoreJobRelevance } from '../relevance/scoreJobRelevance.js';
import { formatMatchNotification } from '../relevance/notificationFormat.js';
import { getSettings } from '../storage/settingsStore.js';

const log = logger.child({ module: 'messageHandler' });

// Baileys uses Long for some numeric fields depending on build; mirrors the
// same handling in imageStore.ts (kept local since that file isn't modified
// here and doesn't export its helper).
type Long = { toNumber(): number };

function toPlainTimestamp(value: number | Long | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toNumber === 'function') return value.toNumber();
  return null;
}

export function extractImageMessage(msg: WAMessage) {
  const message = msg.message;
  if (!message) return undefined;

  return (
    message.imageMessage ??
    message.viewOnceMessageV2?.message?.imageMessage ??
    message.viewOnceMessageV2Extension?.message?.imageMessage ??
    undefined
  );
}

/**
 * Downloads and saves a message's image if it's from a whitelisted group or channel.
 * Shared by the live `messages.upsert` handler and history-backfill scripts
 * (see src/scripts/testCaptureFromHistory.ts) so both paths exercise the
 * exact same capture logic.
 */
export async function captureImageIfMatch(sock: WASocket, msg: WAMessage): Promise<boolean> {
  if (!msg.message) return false;

  // No `fromMe` skip here: safeSend.ts already makes it structurally
  // impossible for the bot to post into a group, so in real target groups
  // fromMe is always false anyway. Skipping it would also break testing in
  // single-member groups where the bot's own number is the only sender.
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || !isMonitoredChat(remoteJid)) return false;

  const imageMessage = extractImageMessage(msg);
  if (!imageMessage) return false;

  try {
    const buffer = remoteJid.endsWith('@newsletter')
      ? await downloadChannelMedia(imageMessage)
      : ((await downloadMediaMessage(
          msg,
          'buffer',
          {},
          { logger: log, reuploadRequest: sock.updateMediaMessage },
        )) as Buffer);

    const { imagePath, metadataPath } = await imageStore.save({
      groupJid: remoteJid,
      sender: msg.key.participant ?? remoteJid,
      timestamp: msg.messageTimestamp,
      mimetype: imageMessage.mimetype,
      fileLength: imageMessage.fileLength,
      caption: imageMessage.caption,
      messageId: msg.key.id,
      buffer,
    });

    const imageHash = await computeDHash(buffer);
    const duplicate = jobStore.findNearDuplicate(imageHash);

    const extractionResult: ExtractionOutcome = duplicate
      ? { ocrPreFilterResult: null, extracted: null, extractionSkippedReason: 'duplicate_repost' }
      : await extractJobData({ buffer, caption: imageMessage.caption });
    await imageStore.updateExtraction(metadataPath, extractionResult);

    const filterResult = evaluateKeywordFilter({
      extracted: extractionResult.extracted,
      ocrPreFilterResult: extractionResult.ocrPreFilterResult,
      caption: imageMessage.caption ?? null,
    });

    const jobId = jobStore.insertJob({
      groupJid: remoteJid,
      sender: msg.key.participant ?? remoteJid,
      messageId: msg.key.id ?? null,
      messageTimestamp: toPlainTimestamp(msg.messageTimestamp),
      imagePath,
      metadataPath,
      imageHash,
      duplicateOfId: duplicate?.id ?? null,
      caption: imageMessage.caption ?? null,
      ocrText: extractionResult.ocrPreFilterResult?.text ?? null,
      ocrConfidence: extractionResult.ocrPreFilterResult?.confidence ?? null,
      ocrHasKeyword: extractionResult.ocrPreFilterResult?.hasKeyword ?? false,
      extracted: extractionResult.extracted,
      extractionSkippedReason: extractionResult.extractionSkippedReason,
      keywordMatch: filterResult.keywordMatch,
      matchedKeyword: filterResult.matchedKeyword,
    });

    const jobRow = jobStore.getJobById(jobId);
    const notYetScored = jobRow !== null && jobRow.relevance_score === null && jobRow.relevance_skipped_reason === null;

    if (jobRow && jobRow.status === 'new' && notYetScored) {
      if (extractionResult.extracted) {
        const relevanceOutcome = await scoreJobRelevance({
          extracted: extractionResult.extracted,
          caption: imageMessage.caption ?? null,
        });

        jobStore.setRelevanceResult(jobId, {
          score: relevanceOutcome.relevance?.score ?? null,
          reasoning: relevanceOutcome.relevance?.reasoning ?? null,
          skippedReason: relevanceOutcome.relevanceSkippedReason,
        });

        if (relevanceOutcome.relevance && relevanceOutcome.relevance.score >= relevanceOutcome.notifyThreshold) {
          try {
            const { notificationLanguage, notifyNumbers } = getSettings();
            const sendImageToRecipients = createSafeImageSender(sock, notifyNumbers);
            await sendImageToRecipients(
              buffer,
              formatMatchNotification({
                jobId,
                extracted: extractionResult.extracted,
                relevance: relevanceOutcome.relevance,
                language: notificationLanguage,
              }),
            );
            jobStore.markNotified(jobId);
          } catch (err) {
            log.error({ err, jobId }, 'failed to send relevance match notification');
          }
        }
      } else {
        jobStore.setRelevanceResult(jobId, { score: null, reasoning: null, skippedReason: 'no_extracted_data' });
        log.debug({ jobId }, 'skipping relevance scoring: no structured extraction data available');
      }
    }

    log.info(
      {
        groupJid: remoteJid,
        sender: msg.key.participant ?? remoteJid,
        timestamp: msg.messageTimestamp,
        mimetype: imageMessage.mimetype,
        fileLength: imageMessage.fileLength,
        caption: imageMessage.caption,
        imagePath,
        metadataPath,
        jobId,
      },
      'captured job flyer image',
    );
    return true;
  } catch (err) {
    log.error({ err, remoteJid, messageId: msg.key.id }, 'failed to download/save image message');
    return false;
  }
}

export function registerMessageHandler(sock: WASocket): void {
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      void captureImageIfMatch(sock, msg);
    }
  });
}
