// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallSummaryExtensionPublic } from './callSummaryExtension.std.ts';

export const CALL_SUMMARY_EXTENSION_CHANGED = 'call-summary-extension-changed';

type ExtensionListener = (state: CallSummaryExtensionPublic) => void;

const listeners = new Set<ExtensionListener>();

export const callSummaryExtensionEvents = {
  on(listener: ExtensionListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  emit(state: CallSummaryExtensionPublic): void {
    for (const listener of listeners) {
      listener(state);
    }
  },
};
