// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { LocalLlmExtensionPublic } from './localLlmExtension.std.ts';

const log = createLogger('minutes/localLlmExtensionEvents');

export type LocalLlmExtensionEventListener = (
  state: LocalLlmExtensionPublic
) => void;

const listeners = new Set<LocalLlmExtensionEventListener>();

export const localLlmExtensionEvents = {
  on(listener: LocalLlmExtensionEventListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit(state: LocalLlmExtensionPublic): void {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        log.warn(
          'localLlmExtensionEvents listener failed',
          error instanceof Error ? error.message : error
        );
      }
    }
  },
};
