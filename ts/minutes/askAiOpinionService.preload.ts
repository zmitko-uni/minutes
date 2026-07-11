// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { getAuthor, getSource } from '../messages/sources.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import { trimAiOpinionResponse } from './aiOpinionPrompts.std.ts';
import { generateAiOpinion, getAiSettings } from './aiSettingsService.preload.ts';
import {
  formatChatMessageHeader,
  formatMenuActionLabel,
} from './branding.std.ts';
import {
  sendSignalChatMessage,
  truncateSignalChatMessage,
} from './sendSignalChatMessage.preload.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('minutes/askAiOpinion');

const AI_OPINION_TIMEOUT_MS = 120_000;
const AI_OPINION_LOCAL_TIMEOUT_MS = 600_000;

function isNoteToSelfConversation(conversationId: string): boolean {
  return (
    conversationId === window.ConversationController.getOurConversationId()
  );
}

function getMessageBody(message: {
  get: (key: 'body') => string | undefined;
}): string {
  return message.get('body')?.trim() ?? '';
}

export async function askAiOpinionFromMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.InvalidConversation,
    });
    return;
  }

  const message = await getMessageById(messageId);
  if (!message) {
    summaryUi.showError('Zpráva nebyla nalezena.');
    return;
  }

  if (message.get('conversationId') !== conversationId) {
    log.warn('askAiOpinionFromMessage: conversation mismatch');
    return;
  }

  const messageText = getMessageBody(message);
  if (!messageText) {
    summaryUi.showError('Zpráva nemá text — názor AI lze použít jen u textové zprávy.');
    return;
  }

  const isNoteToSelf = isNoteToSelfConversation(conversationId);
  const author =
    getAuthor(message.attributes)?.getTitle() ??
    getSource(message.attributes) ??
    'neznámý';
  const conversationTitle = conversation.getTitle();

  summaryUi.showWorking(
    formatMenuActionLabel('Generuji názor AI…')
  );

  let settings;
  try {
    settings = await getAiSettings();
  } catch (error) {
    log.error(`getAiSettings failed: ${Errors.toLogFormat(error)}`);
    summaryUi.showError('Nepodařilo se načíst nastavení AI.');
    return;
  }

  if (!settings.aiEnabled) {
    summaryUi.showError(
      'AI je vypnutá — zapněte ji v Minutes → Nastavení AI.'
    );
    return;
  }

  const timeoutMs =
    settings.provider === 'local'
      ? AI_OPINION_LOCAL_TIMEOUT_MS
      : AI_OPINION_TIMEOUT_MS;

  try {
    const rawOpinion = await Promise.race([
      generateAiOpinion({
        conversationTitle,
        messageAuthorLabel: author,
        messageText,
        isNoteToSelf,
      }),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Časový limit AI vypršel')), timeoutMs);
      }),
    ]);

    const opinion = trimAiOpinionResponse(rawOpinion);
    if (!opinion) {
      summaryUi.showError('AI vrátila prázdnou odpověď.');
      return;
    }

    const header = formatChatMessageHeader('ai-opinion', conversationTitle);
    const messageBody = truncateSignalChatMessage(header, opinion);

    const sent = await sendSignalChatMessage(
      conversationId,
      messageBody,
      'askAiOpinionFromMessage'
    );

    if (sent) {
      summaryUi.showWorking('Názor AI odeslán do chatu.');
      setTimeout(() => summaryUi.hide(), 2500);
    } else {
      summaryUi.hide();
    }
  } catch (error) {
    const message = Errors.toLogFormat(error);
    log.error(`askAiOpinionFromMessage failed: ${message}`);
    summaryUi.showError(`Názor AI selhal: ${message}`);
  }
}
