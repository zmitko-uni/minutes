// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { AiProvider, AiSummaryStyle } from './aiSettings.std.ts';
import type {
  CallRecordingMetadata,
  CallRecordingOutput,
} from './types.std.ts';
import type { TranscriptionProgressPhase } from './transcriptionProgress.std.ts';

export type TranscriptionJobKind = 'transcription' | 'summary';

/**
 * Jednorázová volba z detailu nahrávky — jinak se použije to,
 * co je v Nastavení AI a v Nastavení přepisů.
 */
export type TranscriptionJobOptions = Readonly<{
  whisperModelFileName?: string;
  summaryProvider?: AiProvider;
  summaryModel?: string;
  summaryStyle?: AiSummaryStyle;
}>;

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
  options?: TranscriptionJobOptions;
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
