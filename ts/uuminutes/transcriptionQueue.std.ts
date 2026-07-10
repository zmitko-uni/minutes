// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { CallRecordingMetadata, CallRecordingOutput } from './types.std.ts';
import type { TranscriptionProgressPhase } from './transcriptionProgress.std.ts';

export type TranscriptionJobKind = 'transcription' | 'summary';

export type TranscriptionJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TranscriptionJob = Readonly<{
  id: string;
  kind: TranscriptionJobKind;
  metadata: CallRecordingMetadata;
  status: TranscriptionJobStatus;
  progress: number;
  progressPhase?: TranscriptionProgressPhase;
  progressDetail?: string;
  output?: CallRecordingOutput;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  /** Set when user requests cancel during Whisper (job still processing). */
  cancelRequested?: boolean;
}>;

export type TranscriptionQueueSnapshot = Readonly<{
  jobs: ReadonlyArray<TranscriptionJob>;
  queuePaused: boolean;
  activeJobId: string | null;
  panelOpen: boolean;
}>;
