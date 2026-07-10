// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Zobrazovaný název aplikace (menu, dialogy, tray, instalátor). */
export const APP_DISPLAY_NAME = 'Minutes';

/** Prefix pro položky kontextového menu (např. „Minutes: Sumarizovat odtud"). */
export const APP_MENU_PREFIX = APP_DISPLAY_NAME;

export const APP_README_LABEL = 'Příručka Minutes';

export function formatAppDialogTitle(suffix: string): string {
  return `${APP_DISPLAY_NAME} — ${suffix}`;
}

export function formatMenuActionLabel(action: string): string {
  return `${APP_MENU_PREFIX}: ${action}`;
}

export function formatExportHeader(kind: 'chat-summary' | 'call-transcript'): string {
  if (kind === 'call-transcript') {
    return `# ${APP_DISPLAY_NAME} — přepis hovoru`;
  }
  return `# ${APP_DISPLAY_NAME} — chat summary`;
}

export function formatChatMessageHeader(
  kind: 'chat-summary' | 'call-transcript' | 'call-summary',
  conversationTitle: string
): string {
  const emoji =
    kind === 'call-transcript' ? '🎙️' : kind === 'call-summary' ? '📝' : '📋';
  const label =
    kind === 'call-transcript'
      ? `${APP_DISPLAY_NAME} — přepis hovoru`
      : kind === 'call-summary'
        ? `${APP_DISPLAY_NAME} — shrnutí hovoru`
        : `${APP_DISPLAY_NAME} — shrnutí chatu`;
  return `${emoji} ${label}\n${conversationTitle}\n\n`;
}
