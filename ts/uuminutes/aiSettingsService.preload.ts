// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type {
  AiSettingsPublic,
  AiSettingsSaveInput,
  AiProvider,
} from './aiSettings.std.ts';

export async function getAiSettings(): Promise<AiSettingsPublic> {
  return ipcRenderer.invoke('uuminutes:get-ai-settings');
}

export async function saveAiSettings(
  input: AiSettingsSaveInput
): Promise<AiSettingsPublic> {
  return ipcRenderer.invoke('uuminutes:save-ai-settings', input);
}

export async function testAiSettings(options: {
  apiKey?: string;
  provider: AiProvider;
  model: string;
}): Promise<{ ok: true; message: string }> {
  return ipcRenderer.invoke('uuminutes:test-ai-settings', options);
}

export async function generateAiSummary(options: {
  conversationTitle: string;
  scopeLabel: string;
  transcript: string;
}): Promise<string> {
  return ipcRenderer.invoke('uuminutes:generate-ai-summary', options);
}

export async function generateUnreadConversationSummary(options: {
  conversationTitle: string;
  unreadCount: number;
  transcript: string;
}): Promise<string> {
  return ipcRenderer.invoke(
    'uuminutes:generate-unread-conversation-summary',
    options
  );
}
