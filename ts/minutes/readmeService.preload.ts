// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

const listeners = new Set<() => void>();

export function subscribeReadmeOpen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openReadmeModal(): void {
  for (const listener of listeners) {
    listener();
  }
}

export async function getReadmeContent(): Promise<string> {
  return ipcRenderer.invoke('minutes:get-readme-content');
}
