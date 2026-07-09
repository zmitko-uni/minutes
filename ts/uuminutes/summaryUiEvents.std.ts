// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { ChatSummaryResult } from './types.std.ts';

export type SummaryUiState =
  | Readonly<{ kind: 'idle' }>
  | Readonly<{ kind: 'working'; message: string }>
  | Readonly<{ kind: 'saved'; result: ChatSummaryResult }>
  | Readonly<{ kind: 'error'; message: string }>;

type SummaryUiListener = (state: SummaryUiState) => void;

const listeners = new Set<SummaryUiListener>();
let currentState: SummaryUiState = { kind: 'idle' };

function setState(state: SummaryUiState): void {
  currentState = state;
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribeSummaryUi(
  listener: SummaryUiListener
): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export const summaryUi = {
  showWorking(message: string): void {
    setState({ kind: 'working', message });
  },
  showSaved(result: ChatSummaryResult): void {
    setState({ kind: 'saved', result });
  },
  showError(message: string): void {
    setState({ kind: 'error', message });
  },
  hide(): void {
    setState({ kind: 'idle' });
  },
};
