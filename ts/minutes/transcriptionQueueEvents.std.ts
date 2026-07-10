// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TranscriptionQueueSnapshot } from './transcriptionQueue.std.ts';

type QueueListener = (snapshot: TranscriptionQueueSnapshot) => void;

const listeners = new Set<QueueListener>();
let currentSnapshot: TranscriptionQueueSnapshot = {
  jobs: [],
  queuePaused: false,
  activeJobId: null,
  panelOpen: false,
};

export function getTranscriptionQueueSnapshot(): TranscriptionQueueSnapshot {
  return currentSnapshot;
}

export function emitTranscriptionQueueSnapshot(
  snapshot: TranscriptionQueueSnapshot
): void {
  currentSnapshot = snapshot;
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function subscribeTranscriptionQueue(
  listener: QueueListener
): () => void {
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}
