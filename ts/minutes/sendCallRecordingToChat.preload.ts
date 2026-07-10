// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import { formatChatMessageHeader } from './branding.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import type { CallRecordingOutput } from './types.std.ts';
import type { CallRecordingCatalogEntry } from './recordingsCatalog.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';
import { replaceLegacyLocalSpeakerLabels } from './speakerActivity.std.ts';

const log = createLogger('minutes/sendCallRecording');

const MAX_MESSAGE_BODY_LENGTH = 64 * 1024;

function truncateBody(header: string, body: string): string {
  const maxBodyLength = MAX_MESSAGE_BODY_LENGTH - header.length - 80;
  if (body.length <= maxBodyLength) {
    return `${header}${body}`;
  }
  return `${header}${body.slice(0, maxBodyLength)}\n\n… (text pokračuje v uloženém souboru)`;
}

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
  return truncateBody(header, body);
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
  return truncateBody(header, body);
}

async function sendToConversation(
  conversationId: string,
  body: string
): Promise<boolean> {
  const conversation = window.ConversationController.get(conversationId);
  if (!conversation) {
    log.warn(`sendCallRecording: conversation not found (${conversationId})`);
    window.reduxActions.toast.showToast({
      toastType: ToastType.InvalidConversation,
    });
    return false;
  }

  if (body.length > MAX_MESSAGE_BODY_LENGTH) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.MessageBodyTooLong,
    });
    return false;
  }

  try {
    await conversation.enqueueMessageForSend(
      { body, attachments: [] },
      { dontClearDraft: true }
    );
    return true;
  } catch (error) {
    log.error(`sendCallRecording failed: ${Errors.toLogFormat(error)}`);
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }
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
