// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { TRANSCRIPTION_CANCELLED_MESSAGE } from './transcriptionCancel.std.ts';

const cancelledJobIds = new Set<string>();

export class TranscriptionCancelledError extends Error {
  constructor() {
    super(TRANSCRIPTION_CANCELLED_MESSAGE);
    this.name = 'TranscriptionCancelledError';
  }
}

export function cancelTranscriptionJob(jobId: string): void {
  cancelledJobIds.add(jobId);
}

export function isTranscriptionJobCancelled(jobId: string | undefined): boolean {
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
