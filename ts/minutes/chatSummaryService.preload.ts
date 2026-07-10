// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { DataReader } from '../sql/Client.preload.ts';
import type { MessageType } from '../sql/Interface.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { getAuthor } from '../messages/sources.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import { getNotificationTextForMessage } from '../util/getNotificationTextForMessage.preload.ts';
import { getMessageSentTimestamp } from '../util/getMessageSentTimestamp.std.ts';
import { getSelectedConversationId } from '../state/selectors/nav.std.ts';
import { APP_DISPLAY_NAME, formatExportHeader } from './branding.std.ts';
import { CHAT_SUMMARY_MESSAGE_LIMIT } from './constants.std.ts';
import type { ChatSummaryResult, ChatSummaryScope } from './types.std.ts';
import { openRecordingsFolder, openSummariesFolder } from './navigation.preload.ts';
import { generateAiSummary, getAiSettings } from './aiSettingsService.preload.ts';
import { formatAiSummaryProgressMessage } from './aiSettings.std.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('minutes/chatSummary');

const HOUR_MS = 60 * 60 * 1000;
const AI_SUMMARY_TIMEOUT_MS = 120_000;
const AI_SUMMARY_LOCAL_TIMEOUT_MS = 600_000;
/** Max DB pages when scanning by received_at (synced old msgs need full pass). */
const MAX_MESSAGE_SCAN_BATCHES = 80;
const MESSAGE_SCAN_BATCH_SIZE = 100;

function getSentAtForSummary(message: MessageType): number {
  return getMessageSentTimestamp(message, { includeEdits: false, log });
}

function showErrorToast(reason: string): void {
  log.warn(reason);
  summaryUi.showError(reason);
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

function buildSummaryMarkdown(
  conversationTitle: string,
  scopeLabelText: string,
  lines: ReadonlyArray<string>,
  options?: Readonly<{
    aiSummary?: string;
    aiError?: string;
    aiModel?: string;
  }>
): string {
  const header = `${formatExportHeader('chat-summary')}\n\n**Chat:** ${conversationTitle}\n**Scope:** ${scopeLabelText}\n**Messages:** ${lines.length}\n`;
  const modelLine = options?.aiModel ? `\n**AI model:** ${options.aiModel}` : '';
  const body = lines.join('\n\n');

  if (options?.aiSummary) {
    return `${header}${modelLine}\n\n---\n\n## AI Summary\n\n${options.aiSummary}\n\n---\n\n## Source messages\n\n${body}\n`;
  }

  const footer = options?.aiError
    ? `\n\n---\n\n_AI summary failed: ${options.aiError}_`
    : `\n\n---\n\n_AI shrnutí vypnuto — zapněte v menu ${APP_DISPLAY_NAME} → Nastavení AI._`;
  return `${header}${modelLine}\n\n---\n\n${body}${footer}\n`;
}

async function maybeGenerateAiSummary(
  conversationTitle: string,
  scopeLabelText: string,
  lines: ReadonlyArray<string>
): Promise<
  Readonly<{
    aiSummary?: string;
    aiError?: string;
    aiModel?: string;
    aiSkippedReason?: 'disabled' | 'no_key';
  }>
> {
  const settings = await getAiSettings();
  if (!settings.aiEnabled) {
    return { aiSkippedReason: 'disabled' };
  }
  if (!settings.hasApiKey) {
    return { aiSkippedReason: 'no_key' };
  }

  const transcript = lines.join('\n\n');
  try {
    log.info(`maybeGenerateAiSummary: calling ${settings.provider}`);
    summaryUi.showWorking(
      formatAiSummaryProgressMessage(settings.provider, settings.model)
    );
    const timeoutMs =
      settings.provider === 'local'
        ? AI_SUMMARY_LOCAL_TIMEOUT_MS
        : AI_SUMMARY_TIMEOUT_MS;
    const aiSummary = await Promise.race([
      generateAiSummary({
        conversationTitle,
        scopeLabel: scopeLabelText,
        transcript,
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
    return { aiSummary, aiModel: settings.model };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown AI error';
    log.warn(`maybeGenerateAiSummary failed: ${message}`);
    return { aiError: message, aiModel: settings.model };
  }
}

async function loadMessagesSince(
  conversationId: string,
  cutoffSentAt: number,
  limit: number
): Promise<Array<MessageType>> {
  const result: Array<MessageType> = [];
  let receivedAt = Number.MAX_VALUE;
  let sentAt = Number.MAX_VALUE;

  for (let batchIndex = 0; batchIndex < MAX_MESSAGE_SCAN_BATCHES; batchIndex += 1) {
    if (result.length >= limit) {
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

    // DB returns chronological order (oldest → newest in batch).
    for (const message of batch) {
      if (getSentAtForSummary(message) >= cutoffSentAt) {
        result.push(message);
      }
    }

    if (result.length >= limit) {
      break;
    }

    const oldestInBatch = batch[0];
    if (oldestInBatch == null) {
      break;
    }
    receivedAt = oldestInBatch.received_at;
    sentAt = oldestInBatch.sent_at;

    // End of conversation — do not infer time window from received_at alone.
    if (batch.length < MESSAGE_SCAN_BATCH_SIZE) {
      break;
    }
  }

  result.sort((a, b) => getSentAtForSummary(a) - getSentAtForSummary(b));

  if (result.length > limit) {
    return result.slice(result.length - limit);
  }

  return result;
}

async function loadMessagesForScope(
  conversationId: string,
  scope: ChatSummaryScope
): Promise<Array<MessageType>> {
  if (scope.kind === 'fromMessage') {
    return DataReader.getNewerMessagesByConversation({
      conversationId,
      messageId: scope.messageId,
      sentAt: scope.fromSentAt,
      receivedAt: scope.fromReceivedAt,
      includeStoryReplies: false,
      storyId: undefined,
      limit: CHAT_SUMMARY_MESSAGE_LIMIT,
    });
  }

  if (scope.kind === 'lastHours') {
    const cutoff = Date.now() - scope.hours * HOUR_MS;
    log.info(
      `loadMessagesForScope: last ${scope.hours}h, cutoff sent_at=${new Date(cutoff).toISOString()}`
    );
    return loadMessagesSince(
      conversationId,
      cutoff,
      CHAT_SUMMARY_MESSAGE_LIMIT
    );
  }

  return DataReader.getOlderMessagesByConversation({
    conversationId,
    limit: CHAT_SUMMARY_MESSAGE_LIMIT,
    includeStoryReplies: false,
    storyId: undefined,
  });
}

function scopeLabel(scope: ChatSummaryScope): string {
  if (scope.kind === 'fromMessage') {
    return `From message at ${new Date(scope.fromSentAt).toISOString()}`;
  }
  if (scope.kind === 'lastHours') {
    return `Posledních ${scope.hours} h (podle času odeslání zprávy)`;
  }
  return `Last ${scope.limit} messages`;
}

export async function summarizeConversation(
  conversationId: string,
  scope: ChatSummaryScope
): Promise<ChatSummaryResult | null> {
  log.info(
    `summarizeConversation: start conversationId=${conversationId} scope=${scopeLabel(scope)}`
  );
  summaryUi.showWorking('Načítám zprávy…');

  try {
    const conversation = window.ConversationController.get(conversationId);
    if (!conversation) {
      showErrorToast(
        `summarizeConversation: conversation not found (${conversationId})`
      );
      return null;
    }

    const conversationTitle = conversation.getTitle();
    const messages = await loadMessagesForScope(conversationId, scope);

    log.info(
      `summarizeConversation: loaded ${messages.length} messages for ${scopeLabel(scope)}`
    );

    const lines = messages
      .map(formatMessageLine)
      .filter((line): line is string => line != null && line.length > 0);

    if (lines.length === 0) {
      showErrorToast(
        `Žádný text k exportu (${messages.length} zpráv v rozsahu). Zkuste delší interval nebo jiný chat.`
      );
      return null;
    }

    summaryUi.showWorking(`Exportuji ${lines.length} zpráv…`);

    const generatedAt = Date.now();
    const scopeLabelText = scopeLabel(scope);
    const aiResult = await maybeGenerateAiSummary(
      conversationTitle,
      scopeLabelText,
      lines
    );
    const summaryText = buildSummaryMarkdown(
      conversationTitle,
      scopeLabelText,
      lines,
      aiResult
    );

    const filePath = await ipcRenderer.invoke('minutes:save-chat-summary', {
      conversationId,
      conversationTitle,
      generatedAt,
      messageCount: lines.length,
      scope: scopeLabelText,
      summaryText,
      aiProvider: aiResult.aiSummary || aiResult.aiError ? 'openai' : undefined,
      aiModel: aiResult.aiModel,
    });

    if (typeof filePath !== 'string') {
      showErrorToast('summarizeConversation: failed to save summary file');
      return null;
    }

    const result: ChatSummaryResult = {
      conversationId,
      conversationTitle,
      messageCount: lines.length,
      generatedAt,
      summaryText,
      filePath,
      scope,
      aiSummary: aiResult.aiSummary,
      aiSkippedReason: aiResult.aiSkippedReason,
      aiError: aiResult.aiError,
    };

    log.info(`summarizeConversation: saved ${filePath}`);

    summaryUi.showSaved(result);

    return result;
  } catch (error) {
    const message = Errors.toLogFormat(error);
    log.error(`summarizeConversation failed: ${message}`);
    showErrorToast(`Summarize selhalo: ${message}`);
    return null;
  }
}

export async function summarizeFromMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const message = await getMessageById(messageId);
  if (!message) {
    showErrorToast(`summarizeFromMessage: message not found (${messageId})`);
    return;
  }

  const fromSentAt =
    typeof message.get === 'function'
      ? message.get('sent_at')
      : message.attributes.sent_at;
  const fromReceivedAt =
    typeof message.get === 'function'
      ? message.get('received_at')
      : message.attributes.received_at;

  await summarizeConversation(conversationId, {
    kind: 'fromMessage',
    fromSentAt,
    fromReceivedAt,
    messageId,
  });
}

export async function summarizeLastHours(
  conversationId: string,
  hours: 1 | 8 | 24
): Promise<void> {
  await summarizeConversation(conversationId, { kind: 'lastHours', hours });
}

export async function summarizeSelectedConversation(): Promise<void> {
  const selectedConversationId = getSelectedConversationId(
    window.reduxStore.getState()
  );

  if (!selectedConversationId) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.InvalidConversation,
    });
    return;
  }

  await summarizeConversation(selectedConversationId, {
    kind: 'recent',
    limit: CHAT_SUMMARY_MESSAGE_LIMIT,
  });
}

export { openRecordingsFolder, openSummariesFolder };
