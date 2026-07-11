// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { APP_DISPLAY_NAME } from './branding.std.ts';

export const AI_DISABLED_MESSAGE_CS = `AI je vypnutá — zapněte ji v menu ${APP_DISPLAY_NAME} → Nastavení AI.`;

export const AI_MISSING_API_KEY_MESSAGE_CS = `Chybí API klíč — doplňte ho v ${APP_DISPLAY_NAME} → Nastavení AI.`;

export const AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS = `Lokální model není stažený — otevřete ${APP_DISPLAY_NAME} → Nastavení AI a klikněte na „Stáhnout a aktivovat".`;

export const AI_LOCAL_MODEL_SAVE_BLOCKED_MESSAGE_CS = `Nejdřív stáhněte a aktivujte lokální model tlačítkem „Stáhnout a aktivovat" níže.`;

/** @deprecated stará hláška z IPC — mapujeme na lidskou verzi v UI */
export const AI_LEGACY_NOT_READY_MESSAGE_CS =
  'AI sumarizace je vypnutá nebo chybí API klíč / lokální model';

export function extractIpcErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const ipcMatch = raw.match(
    /Error invoking remote method[^:]*:\s*(?:Error:\s*)?(.+)/s
  );
  return (ipcMatch?.[1] ?? raw).trim();
}

export function normalizeAiNotReadyMessage(message: string): string {
  if (message === AI_LEGACY_NOT_READY_MESSAGE_CS) {
    return AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS;
  }
  return message;
}

export function formatAiFeatureError(
  error: unknown,
  featureLabel: string
): string {
  const message = normalizeAiNotReadyMessage(extractIpcErrorMessage(error));
  if (
    message === AI_DISABLED_MESSAGE_CS ||
    message === AI_MISSING_API_KEY_MESSAGE_CS ||
    message === AI_LOCAL_MODEL_NOT_READY_MESSAGE_CS ||
    message === AI_LOCAL_MODEL_SAVE_BLOCKED_MESSAGE_CS
  ) {
    return message;
  }
  return `${featureLabel} selhal: ${message}`;
}
