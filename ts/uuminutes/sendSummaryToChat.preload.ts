// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { formatChatMessageHeader } from './branding.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import type { ChatSummaryResult } from './types.std.ts';

const log = createLogger('uuminutes/sendSummary');

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

function extractChatSummaryBody(summaryText: string): string {
  return summaryText.replace(/^#.*\n+/m, '').trim();
}

function buildTranscriptChatBody(result: ChatSummaryResult): string {
  const transcript = result.transcriptText?.trim() ?? result.summaryText.trim();
  if (transcript.length > 0) {
    return transcript;
  }
  return extractChatSummaryBody(result.summaryText);
}

function buildSummaryChatMessage(result: ChatSummaryResult): string {
  const isTranscript = result.filePath.includes('.transcript.');
  const header = isTranscript
    ? formatChatMessageHeader('call-transcript', result.conversationTitle)
    : formatChatMessageHeader('chat-summary', result.conversationTitle);

  if (result.aiSummary?.trim()) {
    return `${header}${result.aiSummary.trim()}`;
  }

  const body = isTranscript
    ? buildTranscriptChatBody(result)
    : extractChatSummaryBody(result.summaryText);

  if (!body) {
    return `${header}(Prázdný export.)`;
  }

  const maxBodyLength = MAX_MESSAGE_BODY_LENGTH - header.length - 80;
  if (body.length <= maxBodyLength) {
    return `${header}${body}`;
  }

  return `${header}${body.slice(0, maxBodyLength)}\n\n… (přepis pokračuje v uloženém souboru)`;
}

async function sendSummaryToConversation(
  result: ChatSummaryResult,
  targetConversationId: string
): Promise<boolean> {
  const conversation = window.ConversationController.get(targetConversationId);
  if (!conversation) {
    log.warn(
      `sendSummaryToChat: conversation not found (${targetConversationId})`
    );
    window.reduxActions.toast.showToast({
      toastType: ToastType.InvalidConversation,
    });
    return false;
  }

  const body = buildSummaryChatMessage(result);
  if (body.length > MAX_MESSAGE_BODY_LENGTH) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.MessageBodyTooLong,
    });
    return false;
  }

  try {
    await conversation.enqueueMessageForSend(
      {
        body,
        attachments: [],
      },
      {
        dontClearDraft: true,
      }
    );

    log.info(`sendSummaryToChat: queued summary for ${targetConversationId}`);
    return true;
  } catch (error) {
    log.error(`sendSummaryToChat failed: ${Errors.toLogFormat(error)}`);
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }
}

export async function sendSummaryToChat(
  result: ChatSummaryResult
): Promise<boolean> {
  return sendSummaryToConversation(result, result.conversationId);
}

export async function sendSummaryToSelf(
  result: ChatSummaryResult
): Promise<boolean> {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  if (!selfConversationId) {
    log.warn('sendSummaryToSelf: Note to Self conversation not found');
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }

  return sendSummaryToConversation(result, selfConversationId);
}

export function isSummaryFromSelfChat(result: ChatSummaryResult): boolean {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  return (
    selfConversationId != null && result.conversationId === selfConversationId
  );
}
