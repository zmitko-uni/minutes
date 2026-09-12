// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { showMinutesTranscriptsForConversation } from '../navTabsService.preload.ts';

/**
 * Tlačítko „M“ v hlavičce chatu. Otevře tab Přepisy zúžený jen na nahrávky
 * tohoto chatu — jeden chat jich může mít víc.
 */
export function MinutesConversationHeaderButton({
  conversationId,
}: Readonly<{ conversationId: string }>): JSX.Element {
  return (
    <button
      type="button"
      className="MinutesConversationHeaderButton"
      title="Přepisy Minutes z tohoto chatu"
      aria-label="Přepisy Minutes z tohoto chatu"
      onClick={() => showMinutesTranscriptsForConversation(conversationId)}
    >
      M
    </button>
  );
}
