// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getMinutesDisplayName } from './releaseChannel.std.ts';

/** Zobrazovaný název aplikace (menu, dialogy, tray, instalátor). */
export const APP_DISPLAY_NAME = getMinutesDisplayName();

/** Prefix pro položky kontextového menu (např. „Minutes: Sumarizovat odtud"). */
export const APP_MENU_PREFIX = APP_DISPLAY_NAME;

export const APP_README_LABEL = 'Příručka Minutes';

export function formatAppDialogTitle(suffix: string): string {
  return `${APP_DISPLAY_NAME} — ${suffix}`;
}

export function formatMenuActionLabel(action: string): string {
  return `${APP_MENU_PREFIX}: ${action}`;
}

/** Popisek položky hlavního menu Minutes, např. „Přepisy (Minutes)". */
export function formatMinutesScopedMenuLabel(action: string): string {
  return `${action} (${APP_DISPLAY_NAME})`;
}

export function formatExportHeader(
  kind: 'chat-summary' | 'call-transcript'
): string {
  if (kind === 'call-transcript') {
    return `# ${APP_DISPLAY_NAME} — přepis hovoru`;
  }
  return `# ${APP_DISPLAY_NAME} — chat summary`;
}

export function formatUnreadDigestHeader(): string {
  return `📬 ${APP_DISPLAY_NAME} — přehled nepřečtených\n\n`;
}

type ChatMessageKind =
  | 'chat-summary'
  | 'call-transcript'
  | 'call-summary'
  | 'ai-opinion'
  | 'business-card';

const CHAT_MESSAGE_HEADERS: Readonly<
  Record<ChatMessageKind, Readonly<{ emoji: string; label: string }>>
> = {
  'chat-summary': { emoji: '📋', label: 'shrnutí chatu' },
  'call-transcript': { emoji: '🎙️', label: 'přepis hovoru' },
  'call-summary': { emoji: '📝', label: 'shrnutí hovoru' },
  'ai-opinion': { emoji: '🤖', label: 'názor AI' },
  'business-card': { emoji: '👤', label: 'vizitka' },
};

export function formatChatMessageHeader(
  kind: ChatMessageKind,
  conversationTitle: string
): string {
  const { emoji, label } = CHAT_MESSAGE_HEADERS[kind];
  return `${emoji} ${APP_DISPLAY_NAME} — ${label}\n${conversationTitle}\n\n`;
}
