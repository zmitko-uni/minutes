// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type {
  AiSettingsPublic,
  AiSettingsSaveInput,
  AiProvider,
} from './aiSettings.std.ts';

export async function getAiSettings(): Promise<AiSettingsPublic> {
  return ipcRenderer.invoke('minutes:get-ai-settings');
}

export async function saveAiSettings(
  input: AiSettingsSaveInput
): Promise<AiSettingsPublic> {
  return ipcRenderer.invoke('minutes:save-ai-settings', input);
}

export async function testAiSettings(options: {
  apiKey?: string;
  provider: AiProvider;
  model: string;
}): Promise<{ ok: true; message: string }> {
  return ipcRenderer.invoke('minutes:test-ai-settings', options);
}

export async function generateAiSummary(options: {
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}): Promise<string> {
  return ipcRenderer.invoke('minutes:generate-ai-summary', options);
}

export async function generateUnreadConversationSummary(options: {
  conversationTitle: string;
  unreadCount: number;
  transcript: string;
}): Promise<string> {
  return ipcRenderer.invoke(
    'minutes:generate-unread-conversation-summary',
    options
  );
}

export async function generateAiOpinion(options: {
  conversationTitle: string;
  messageAuthorLabel: string;
  messageText: string;
  isNoteToSelf: boolean;
}): Promise<string> {
  return ipcRenderer.invoke('minutes:generate-ai-opinion', options);
}
