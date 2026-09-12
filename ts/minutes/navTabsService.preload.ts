// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { NavTab } from '../types/Nav.std.ts';

/**
 * Tab Přepisy se může otevřít zúžený na jeden chat (tlačítko „M“ v chatu).
 * Hodnota se drží i mimo React, protože tab bývá při vyvolání akce
 * ještě nenamountovaný.
 */
let pendingConversationFilter: string | null = null;
const conversationFilterListeners = new Set<
  (conversationId: string | null) => void
>();

/** Přepne levou navigaci na tab Přepisy (menu, zkratka, pill fronty). */
export function showMinutesTranscriptsTab(): void {
  pendingConversationFilter = null;
  window.reduxActions?.nav?.changeLocation({ tab: NavTab.MinutesTranscripts });
  for (const listener of conversationFilterListeners) {
    listener(null);
  }
}

/** Otevře tab Přepisy jen s nahrávkami daného chatu. */
export function showMinutesTranscriptsForConversation(
  conversationId: string
): void {
  pendingConversationFilter = conversationId;
  window.reduxActions?.nav?.changeLocation({ tab: NavTab.MinutesTranscripts });
  for (const listener of conversationFilterListeners) {
    listener(conversationId);
  }
}

export function getMinutesConversationFilter(): string | null {
  return pendingConversationFilter;
}

export function clearMinutesConversationFilter(): void {
  pendingConversationFilter = null;
}

export function subscribeMinutesConversationFilter(
  listener: (conversationId: string | null) => void
): () => void {
  conversationFilterListeners.add(listener);
  return () => {
    conversationFilterListeners.delete(listener);
  };
}

/** Přepne levou navigaci na tab Záložky. */
export function showMinutesBookmarksTab(): void {
  window.reduxActions?.nav?.changeLocation({ tab: NavTab.MinutesBookmarks });
}
