// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { DataReader } from '../sql/Client.preload.ts';
import type { MessageType } from '../sql/Interface.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.ts';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.ts';
import { isMessageUnread } from '../util/isMessageUnread.std.ts';
import { getAuthor } from '../messages/sources.preload.ts';
import { formatUnreadDigestHeader } from './branding.std.ts';
import {
  UNREAD_SUMMARY_MAX_CONVERSATIONS,
  UNREAD_SUMMARY_PER_CHAT_LIMIT,
} from './constants.std.ts';
import { generateUnreadConversationSummary, getAiSettings } from './aiSettingsService.preload.ts';
import {
  AI_DISABLED_MESSAGE_CS,
  AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS,
  AI_MISSING_API_KEY_MESSAGE_CS,
} from './aiUserMessages.std.ts';
import { formatAiSummaryProgressMessage } from './aiSettings.std.ts';
import { sendSignalChatMessage } from './sendSignalChatMessage.preload.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('minutes/unreadSummary');

const MESSAGE_SCAN_BATCH_SIZE = 50;
const MAX_MESSAGE_SCAN_BATCHES = 40;
const AI_SUMMARY_TIMEOUT_MS = 90_000;
const AI_SUMMARY_LOCAL_TIMEOUT_MS = 300_000;
const MAX_DIGEST_MESSAGE_LENGTH = 64 * 1024;

type UnreadConversationTarget = Readonly<{
  id: string;
  title: string;
  unreadCount: number;
}>;

function getSentAtForSummary(message: MessageType): number {
  return getMessageSentTimestamp(message, { includeEdits: false, log });
}

function formatMessageLine(message: MessageType): string | null {
  let text: string;
  try {
    text = getNotificationTextForMessage(message).trim();
  } catch (error) {
    log.warn(
      `formatMessageLine: skip message ${message.id}: ${Errors.toLogFormat(error)}`
    );
    return null;
  }

  if (!text) {
    return null;
  }

  const author = getAuthor(message)?.getTitle() ?? message.source ?? 'unknown';
  const timestamp = new Date(getSentAtForSummary(message)).toISOString();
  return `[${timestamp}] ${author}:\n${text}`;
}

function isSkippedAiSummary(response: string): boolean {
  const trimmed = response.trim();
  if (!trimmed) {
    return true;
  }
  return /^skip\b/i.test(trimmed) && trimmed.length <= 20;
}

const CONVERSATIONAL_PREFIX =
  /^(rozumím|jistě|samozřejmě|shrnutí|zde je|tady je|ok\.?|okay\.?)\b[,:.]?\s*/i;

function normalizeConversationType(rawType: string | undefined): string {
  const value = rawType?.trim().toLowerCase() ?? '';
  if (value.includes('krit')) {
    return 'kritická';
  }
  if (value.includes('důle') || value.includes('dule')) {
    return 'důležitá';
  }
  if (value.includes('neform') || value.includes('informal')) {
    return 'neformální';
  }
  if (value.includes('běž') || value.includes('bez') || value.includes('normal')) {
    return 'běžná';
  }
  if (value.includes('important')) {
    return 'důležitá';
  }
  if (value.includes('critical')) {
    return 'kritická';
  }
  return rawType?.trim() || 'běžná';
}

function parseUnreadAiResponse(aiResponse: string): Readonly<{
  topic: string | undefined;
  bullets: ReadonlyArray<string>;
  typeLabel: string;
}> {
  const trimmed = aiResponse.trim();
  const temaMatch = trimmed.match(/^TÉMA:\s*(.+)$/im);
  const typMatch = trimmed.match(/^TYP:\s*(.+)$/im);
  const bullets = [...trimmed.matchAll(/^-\s+(.+)$/gm)]
    .map(match => match[1]?.trim())
    .filter((line): line is string => line != null && line.length > 0);

  let topic = temaMatch?.[1]?.trim();
  if (!topic && bullets.length === 0) {
    const fallback = trimmed
      .replace(/^TÉMA:\s*/im, '')
      .replace(/^TYP:\s*.+$/im, '')
      .replace(/^-\s+.+$/gm, '')
      .trim();
    topic = fallback.replace(CONVERSATIONAL_PREFIX, '').trim() || undefined;
  }

  return {
    topic,
    bullets,
    typeLabel: normalizeConversationType(typMatch?.[1]),
  };
}

function formatUnreadConversationBlock(
  chatTitle: string,
  aiResponse: string
): string {
  const parsed = parseUnreadAiResponse(aiResponse);
  const lines = [`**${chatTitle}**`, ''];

  if (parsed.topic) {
    lines.push(`Téma: ${parsed.topic}`);
  }

  if (parsed.bullets.length > 0) {
    if (parsed.topic) {
      lines.push('');
    }
    for (const bullet of parsed.bullets) {
      lines.push(`- ${bullet}`);
    }
  } else if (parsed.topic) {
    lines.push('');
    lines.push(`- ${parsed.topic}`);
  }

  lines.push('');
  lines.push(`Typ: ${parsed.typeLabel}`);

  return lines.join('\n');
}

function formatUnreadConversationErrorBlock(
  chatTitle: string,
  message: string
): string {
  return [
    `**${chatTitle}**`,
    '',
    'Téma: Nepodařilo se vygenerovat shrnutí',
    '',
    `- ${message}`,
    '',
    'Typ: chyba',
  ].join('\n');
}

function getUnreadConversationTargets(): Array<UnreadConversationTarget> {
  const selfConversationId =
    window.ConversationController.getOurConversationId();

  return window.ConversationController.getAll()
    .filter(conversation => {
      if (conversation.id === selfConversationId) {
        return false;
      }
      if (conversation.get('left')) {
        return false;
      }
      if (conversation.get('isArchived')) {
        return false;
      }
      const unreadCount = conversation.get('unreadCount') ?? 0;
      return unreadCount > 0;
    })
    .sort(
      (left, right) =>
        (right.get('timestamp') ?? 0) - (left.get('timestamp') ?? 0)
    )
    .slice(0, UNREAD_SUMMARY_MAX_CONVERSATIONS)
    .map(conversation => ({
      id: conversation.id,
      title: conversation.getTitle(),
      unreadCount: conversation.get('unreadCount') ?? 0,
    }));
}

async function loadUnreadMessagesForConversation(
  conversationId: string,
  unreadCount: number
): Promise<Array<MessageType>> {
  const targetCount = Math.min(unreadCount, UNREAD_SUMMARY_PER_CHAT_LIMIT);
  const unreadMessages: Array<MessageType> = [];
  let receivedAt = Number.MAX_VALUE;
  let sentAt = Number.MAX_VALUE;

  for (
    let batchIndex = 0;
    batchIndex < MAX_MESSAGE_SCAN_BATCHES;
    batchIndex += 1
  ) {
    if (unreadMessages.length >= targetCount) {
      break;
    }

    // oxlint-disable-next-line no-await-in-loop
    const batch = await DataReader.getOlderMessagesByConversation({
      conversationId,
      receivedAt,
      sentAt,
      limit: MESSAGE_SCAN_BATCH_SIZE,
      includeStoryReplies: false,
      storyId: undefined,
    });

    if (batch.length === 0) {
      break;
    }

    for (let index = batch.length - 1; index >= 0; index -= 1) {
      const message = batch[index];
      if (message != null && isMessageUnread(message)) {
        unreadMessages.unshift(message);
      }
    }

    if (unreadMessages.length >= targetCount) {
      break;
    }

    const oldestInBatch = batch[0];
    if (oldestInBatch == null) {
      break;
    }
    receivedAt = oldestInBatch.received_at;
    sentAt = oldestInBatch.sent_at;

    if (batch.length < MESSAGE_SCAN_BATCH_SIZE) {
      break;
    }
  }

  if (unreadMessages.length > targetCount) {
    return unreadMessages.slice(unreadMessages.length - targetCount);
  }

  return unreadMessages;
}

async function summarizeUnreadConversation(
  target: UnreadConversationTarget,
  timeoutMs: number
): Promise<
  Readonly<{
    kind: 'summary';
    text: string;
  }> | Readonly<{
    kind: 'skipped';
  }> | Readonly<{
    kind: 'error';
    message: string;
  }>
> {
  const messages = await loadUnreadMessagesForConversation(
    target.id,
    target.unreadCount
  );

  const lines = messages
    .map(formatMessageLine)
    .filter((line): line is string => line != null && line.length > 0);

  if (lines.length === 0) {
    return { kind: 'skipped' };
  }

  try {
    const aiSummary = await Promise.race([
      generateUnreadConversationSummary({
        conversationTitle: target.title,
        unreadCount: target.unreadCount,
        transcript: lines.join('\n\n'),
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                `AI summary timed out after ${Math.round(timeoutMs / 1000)} seconds`
              )
            ),
          timeoutMs
        );
      }),
    ]);

    if (isSkippedAiSummary(aiSummary)) {
      return { kind: 'skipped' };
    }

    return {
      kind: 'summary',
      text: formatUnreadConversationBlock(target.title, aiSummary),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown AI error';
    log.warn(
      `summarizeUnreadConversation failed for ${target.id}: ${message}`
    );
    return { kind: 'error', message };
  }
}

function buildUnreadDigestMessage(options: {
  generatedAt: number;
  targets: ReadonlyArray<UnreadConversationTarget>;
  summaries: ReadonlyArray<string>;
  skippedCount: number;
  errorCount: number;
  totalUnreadMessages: number;
}): string {
  const header = formatUnreadDigestHeader();
  const generatedLabel = new Date(options.generatedAt).toLocaleString('cs-CZ');
  const intro = [
    `Vygenerováno: ${generatedLabel}`,
    `Chatů s nepřečtenými: ${options.targets.length}`,
    `Relevantních shrnutí: ${options.summaries.length}`,
    options.skippedCount > 0
      ? `Přeskočeno (triviální / bez textu): ${options.skippedCount}`
      : undefined,
    options.errorCount > 0 ? `Chyby AI: ${options.errorCount}` : undefined,
    '',
  ]
    .filter((line): line is string => line != null)
    .join('\n');

  const body =
    options.summaries.length > 0
      ? options.summaries.join('\n\n')
      : 'Žádné relevantní nepřečtené konverzace k zobrazení (vše triviální nebo prázdné).';

  const footer = `\n\nCelkem nepřečtených zpráv v přehledu: ${options.totalUnreadMessages}`;

  return `${header}${intro}${body}${footer}`;
}

async function sendDigestToSelf(message: string): Promise<boolean> {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  if (!selfConversationId) {
    log.warn('sendDigestToSelf: Note to Self conversation not found');
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }

  if (message.length > MAX_DIGEST_MESSAGE_LENGTH) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.MessageBodyTooLong,
    });
    return false;
  }

  return sendSignalChatMessage(
    selfConversationId,
    message,
    'sendDigestToSelf'
  );
}

export async function summarizeUnreadConversations(): Promise<void> {
  log.info('summarizeUnreadConversations: start');
  summaryUi.showWorking('Hledám chaty s nepřečtenými zprávami…');

  try {
    const settings = await getAiSettings();
    if (!settings.aiEnabled) {
      summaryUi.showError(AI_DISABLED_MESSAGE_CS);
      return;
    }
    if (!settings.hasApiKey) {
      summaryUi.showError(
        settings.provider === 'local'
          ? AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS
          : AI_MISSING_API_KEY_MESSAGE_CS
      );
      return;
    }

    const targets = getUnreadConversationTargets();
    if (targets.length === 0) {
      summaryUi.showError('Nemáte žádné chaty s nepřečtenými zprávami.');
      return;
    }

    const summaries: Array<string> = [];
    let skippedCount = 0;
    let errorCount = 0;
    let totalUnreadMessages = 0;

    const timeoutMs =
      settings.provider === 'local'
        ? AI_SUMMARY_LOCAL_TIMEOUT_MS
        : AI_SUMMARY_TIMEOUT_MS;

    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index];
      if (target == null) {
        continue;
      }

      summaryUi.showWorking(
        `${index + 1}/${targets.length}: ${target.title} — ${formatAiSummaryProgressMessage(settings.provider, settings.model)}`
      );

      // oxlint-disable-next-line no-await-in-loop
      const result = await summarizeUnreadConversation(target, timeoutMs);

      if (result.kind === 'summary') {
        summaries.push(result.text);
        totalUnreadMessages += Math.min(
          target.unreadCount,
          UNREAD_SUMMARY_PER_CHAT_LIMIT
        );
      } else if (result.kind === 'skipped') {
        skippedCount += 1;
      } else {
        errorCount += 1;
        summaries.push(
          formatUnreadConversationErrorBlock(target.title, result.message)
        );
      }
    }

    const generatedAt = Date.now();
    const digestMessage = buildUnreadDigestMessage({
      generatedAt,
      targets,
      summaries: summaries.filter(text => text.length > 0),
      skippedCount,
      errorCount,
      totalUnreadMessages,
    });

    summaryUi.showWorking('Odesílám přehled do Poznámek…');

    const sent = await sendDigestToSelf(digestMessage);
    if (!sent) {
      summaryUi.showError('Nepodařilo se odeslat přehled do Poznámek.');
      return;
    }

    log.info(
      `summarizeUnreadConversations: done (${summaries.length} summaries, ${skippedCount} skipped)`
    );

    summaryUi.hide();
  } catch (error) {
    const message = Errors.toLogFormat(error);
    log.error(`summarizeUnreadConversations failed: ${message}`);
    summaryUi.showError(`Sesumarizace nepřečtených selhala: ${message}`);
  }
}
