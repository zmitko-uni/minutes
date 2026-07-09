// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Navigates to the Minutes welcome home screen (no chat selected). */
export function showMinutesHome(): void {
  window.reduxActions.conversations.showConversation({
    conversationId: undefined,
  });
}
