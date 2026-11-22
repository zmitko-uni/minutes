// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { TRANSCRIPTION_CANCELLED_MESSAGE } from './transcriptionCancel.std.ts';

const cancelledJobIds = new Set<string>();
const cancelHandlers = new Map<string, Set<() => void>>();

export class TranscriptionCancelledError extends Error {
  constructor() {
    super(TRANSCRIPTION_CANCELLED_MESSAGE);
    this.name = 'TranscriptionCancelledError';
  }
}

export function cancelTranscriptionJob(jobId: string): void {
  cancelledJobIds.add(jobId);
  for (const handler of cancelHandlers.get(jobId) ?? []) {
    handler();
  }
}

/**
 * Registers a callback that runs immediately when the job is cancelled
 * (e.g. to kill a running whisper process). Returns an unsubscribe function.
 */
export function onTranscriptionJobCancelled(
  jobId: string | undefined,
  handler: () => void
): () => void {
  if (jobId == null) {
    return () => undefined;
  }
  const handlers = cancelHandlers.get(jobId) ?? new Set<() => void>();
  handlers.add(handler);
  cancelHandlers.set(jobId, handlers);
  return () => {
    handlers.delete(handler);
    if (handlers.size === 0) {
      cancelHandlers.delete(jobId);
    }
  };
}

export function isTranscriptionJobCancelled(
  jobId: string | undefined
): boolean {
  return jobId != null && cancelledJobIds.has(jobId);
}

export function clearTranscriptionJobCancellation(
  jobId: string | undefined
): void {
  if (jobId != null) {
    cancelledJobIds.delete(jobId);
  }
}

export function throwIfTranscriptionCancelled(jobId: string | undefined): void {
  if (isTranscriptionJobCancelled(jobId)) {
    throw new TranscriptionCancelledError();
  }
}
