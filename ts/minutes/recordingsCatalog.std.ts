// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type StoredCallRecordingMetadata = Readonly<{
  conversationId: string;
  conversationTitle: string;
  callMode?: string;
  eraId?: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  audioFile: string;
  speakerActivityFile?: string;
}>;

export type CallRecordingCatalogEntry = Readonly<{
  conversationId: string;
  conversationTitle: string;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  mp3Path: string;
  hasPcmSidecar: boolean;
  hasTranscript: boolean;
  hasSummary: boolean;
  transcriptPath?: string;
  summaryPath?: string;
  transcriptWhisperModelFileName?: string;
  transcriptWhisperModelLabel?: string;
  transcriptGeneratedAt?: number;
}>;
