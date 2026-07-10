// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { formatChatMessageHeader } from './branding.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { CallRecordingOutput } from './types.std.ts';
import type { CallRecordingCatalogEntry } from './recordingsCatalog.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';
import { replaceLegacyLocalSpeakerLabels } from './speakerActivity.std.ts';
import {
  sendSignalChatMessage,
  truncateSignalChatMessage,
} from './sendSignalChatMessage.preload.ts';

const log = createLogger('minutes/sendCallRecording');

function buildTranscriptMessage(output: CallRecordingOutput): string {
  const header = formatChatMessageHeader(
    'call-transcript',
    output.conversationTitle
  );
  const body = replaceLegacyLocalSpeakerLabels(
    output.transcriptText.trim(),
    getLocalSpeakerDisplayName()
  );
  if (!body) {
    return `${header}(Prázdný přepis.)`;
  }
  return truncateSignalChatMessage(header, body);
}

function buildSummaryMessage(output: CallRecordingOutput): string {
  const header = formatChatMessageHeader(
    'call-summary',
    output.conversationTitle
  );
  const body = replaceLegacyLocalSpeakerLabels(
    output.summaryText?.trim() ?? '',
    getLocalSpeakerDisplayName()
  );
  if (!body) {
    return `${header}(Shrnutí není k dispozici.)`;
  }
  return truncateSignalChatMessage(header, body);
}

async function sendToConversation(
  conversationId: string,
  body: string
): Promise<boolean> {
  return sendSignalChatMessage(conversationId, body, 'sendCallRecording');
}

function resolveTargetConversationId(
  output: CallRecordingOutput,
  target: 'conversation' | 'self'
): string | null {
  if (target === 'conversation') {
    return output.conversationId;
  }

  const selfConversationId =
    window.ConversationController.getOurConversationId();
  if (!selfConversationId) {
    log.warn('sendCallRecording: Note to Self conversation not found');
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return null;
  }

  return selfConversationId;
}

export function isCallRecordingFromSelfChat(
  output: CallRecordingOutput
): boolean {
  const selfConversationId =
    window.ConversationController.getOurConversationId();
  return (
    selfConversationId != null && output.conversationId === selfConversationId
  );
}

export async function sendCallTranscriptToChat(
  output: CallRecordingOutput,
  target: 'conversation' | 'self'
): Promise<boolean> {
  const conversationId = resolveTargetConversationId(output, target);
  if (!conversationId) {
    return false;
  }
  return sendToConversation(conversationId, buildTranscriptMessage(output));
}

export async function sendCallSummaryToChat(
  output: CallRecordingOutput,
  target: 'conversation' | 'self'
): Promise<boolean> {
  if (!output.summaryText?.trim()) {
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }

  const conversationId = resolveTargetConversationId(output, target);
  if (!conversationId) {
    return false;
  }
  return sendToConversation(conversationId, buildSummaryMessage(output));
}

export async function loadCallRecordingOutputFromEntry(
  entry: CallRecordingCatalogEntry
): Promise<CallRecordingOutput | null> {
  const result = (await ipcRenderer.invoke(
    'minutes:load-call-recording-output',
    entry
  )) as CallRecordingOutput | null;
  return result ?? null;
}
