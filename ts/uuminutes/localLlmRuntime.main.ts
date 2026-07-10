// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import {
  loadNodeLlamaCpp,
  resetNodeLlamaCppLoader,
} from './loadNodeLlamaCpp.main.ts';

const log = createLogger('uuminutes/localLlmRuntime');

type LocalLlmRuntimeStatus = Readonly<{
  ready: boolean;
  error?: string;
}>;

let cachedStatus: LocalLlmRuntimeStatus | null = null;

export function resetLocalLlmRuntimeCheck(): void {
  cachedStatus = null;
  resetNodeLlamaCppLoader();
}

export async function checkLocalLlmRuntime(): Promise<LocalLlmRuntimeStatus> {
  if (cachedStatus) {
    return cachedStatus;
  }

  try {
    const mod = await loadNodeLlamaCpp();
    if (typeof mod.getLlama !== 'function') {
      throw new Error('node-llama-cpp is missing getLlama');
    }
    await mod.getLlama();
    log.info('node-llama-cpp runtime is available');
    cachedStatus = { ready: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'node-llama-cpp failed to load';
    log.warn(`checkLocalLlmRuntime failed: ${message}`);
    cachedStatus = { ready: false, error: message };
  }

  return cachedStatus;
}
