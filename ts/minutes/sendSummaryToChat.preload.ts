// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { formatChatMessageHeader } from './branding.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { ChatSummaryResult } from './types.std.ts';
import {
  sendSignalChatMessage,
  truncateSignalChatMessage,
} from './sendSignalChatMessage.preload.ts';

const log = createLogger('minutes/sendSummary');

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

  const maxBodyLength = 64 * 1024 - header.length - 80;
  if (body.length <= maxBodyLength) {
    return `${header}${body}`;
  }

  return truncateSignalChatMessage(header, body);
}

async function sendSummaryToConversation(
  result: ChatSummaryResult,
  targetConversationId: string
): Promise<boolean> {
  const message = buildSummaryChatMessage(result);
  return sendSignalChatMessage(
    targetConversationId,
    message,
    'sendSummaryToChat'
  );
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
