// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { NavTab } from '../types/Nav.std.ts';

/** Přepne levou navigaci na tab Přepisy (menu, zkratka, pill fronty). */
export function showMinutesTranscriptsTab(): void {
  window.reduxActions?.nav?.changeLocation({ tab: NavTab.MinutesTranscripts });
}

/** Přepne levou navigaci na tab Záložky. */
export function showMinutesBookmarksTab(): void {
  window.reduxActions?.nav?.changeLocation({ tab: NavTab.MinutesBookmarks });
}
