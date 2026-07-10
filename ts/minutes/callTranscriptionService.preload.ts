// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallRecordingMetadata } from './types.std.ts';
import { enqueueRecordingTranscription } from './transcriptionQueueService.preload.ts';

/** @deprecated Use enqueueRecordingTranscription — kept for imports */
export async function transcribeSavedRecording(
  metadata: CallRecordingMetadata,
  _mp3Data?: Uint8Array,
  _pcm48?: Float32Array
): Promise<void> {
  enqueueRecordingTranscription(metadata);
}

export { enqueueRecordingTranscription };
