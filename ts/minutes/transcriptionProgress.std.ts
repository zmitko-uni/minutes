// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type TranscriptionProgressPhase =
  | 'prepare'
  | 'whisper'
  | 'ai-correction'
  | 'finalize';

export type TranscriptionProgressUpdate = Readonly<{
  percent: number;
  phase?: TranscriptionProgressPhase;
  detail?: string;
}>;

export type TranscriptionProgressCallback = (
  update: TranscriptionProgressUpdate
) => void;

export function clampProgressPercent(percent: number): number {
  return Math.max(0, Math.min(100, Math.round(percent)));
}
