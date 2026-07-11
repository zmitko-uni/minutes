// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { formatChatMessageHeader } from './branding.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { AiOpinionResult } from './types.std.ts';
import {
  sendSignalChatMessage,
  truncateSignalChatMessage,
} from './sendSignalChatMessage.preload.ts';

const log = createLogger('minutes/sendAiOpinion');

function buildAiOpinionChatMessage(result: AiOpinionResult): string {
  const header = formatChatMessageHeader(
    'ai-opinion',
    result.conversationTitle
  );
  return truncateSignalChatMessage(header, result.opinionText);
}

async function sendOpinionToConversation(
  result: AiOpinionResult,
  targetConversationId: string
): Promise<boolean> {
  const message = buildAiOpinionChatMessage(result);
  return sendSignalChatMessage(
    targetConversationId,
    message,
    'sendAiOpinionToChat'
  );
}

export async function sendAiOpinionToChat(
  result: AiOpinionResult
): Promise<boolean> {
  return sendOpinionToConversation(result, result.conversationId);
}

export async function sendAiOpinionToSelf(
  result: AiOpinionResult
): Promise<boolean> {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  if (!selfConversationId) {
    log.warn('sendAiOpinionToSelf: Note to Self conversation not found');
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }

  return sendOpinionToConversation(result, selfConversationId);
}

export function isAiOpinionFromSelfChat(result: AiOpinionResult): boolean {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  return (
    selfConversationId != null && result.conversationId === selfConversationId
  );
}
