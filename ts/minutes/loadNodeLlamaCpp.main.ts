// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

type NodeLlamaCppModule = typeof import('node-llama-cpp');

let loadPromise: Promise<NodeLlamaCppModule> | null = null;

/** node-llama-cpp is ESM-only — must use dynamic import(), not require(). */
export async function loadNodeLlamaCpp(): Promise<NodeLlamaCppModule> {
  if (!loadPromise) {
    loadPromise = import('node-llama-cpp');
  }
  return loadPromise;
}

export function resetNodeLlamaCppLoader(): void {
  loadPromise = null;
}
