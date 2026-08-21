// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import {
  MINUTES_MENU_COPY_WITH_CONTEXT,
  MINUTES_MENU_FORWARD_WITH_CONTEXT,
} from '../menuLabels.std.ts';

export function MinutesSelectModeContextActions({
  canCopy,
  canForward,
  onCopy,
  onForward,
}: Readonly<{
  canCopy: boolean;
  canForward: boolean;
  onCopy: () => void;
  onForward: () => void;
}>): JSX.Element {
  return (
    <>
      <button
        type="button"
        className="SelectModeActions__button"
        title={MINUTES_MENU_COPY_WITH_CONTEXT}
        aria-label={MINUTES_MENU_COPY_WITH_CONTEXT}
        disabled={!canCopy}
        onClick={onCopy}
      >
        <AxoSymbol.Icon symbol="copy" size={20} label={null} />
      </button>
      <button
        type="button"
        className="SelectModeActions__button"
        title={MINUTES_MENU_FORWARD_WITH_CONTEXT}
        aria-label={MINUTES_MENU_FORWARD_WITH_CONTEXT}
        disabled={!canForward}
        onClick={onForward}
      >
        <AxoSymbol.Icon symbol="message-arrow" size={20} label={null} />
      </button>
    </>
  );
}
