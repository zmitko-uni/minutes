// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { SpeakerActivityLog } from './speakerActivity.std.ts';

export const MINUTES_CALL_RECORDING_IPC = {
  create: 'minutes:create-call-recording-file',
  appendMp3: 'minutes:append-call-recording-mp3',
  appendPcm: 'minutes:append-call-recording-pcm',
  finalize: 'minutes:finalize-call-recording-file',
  abort: 'minutes:abort-call-recording-file',
  recover: 'minutes:recover-call-recordings',
} as const;

export type CreateCallRecordingFileOptions = Readonly<{
  conversationId: string;
  conversationTitle: string;
  callMode: string;
  eraId?: string;
  startedAt: number;
}>;

export type CreatedCallRecordingFile = Readonly<{
  sessionId: string;
  partialPath: string;
}>;

export type AppendCallRecordingMp3Input = Readonly<{
  sessionId: string;
  data: Uint8Array<ArrayBuffer>;
}>;

export type AppendCallRecordingPcmInput = Readonly<{
  sessionId: string;
  samples: Float32Array<ArrayBuffer>;
}>;

export type FinalizeCallRecordingFileInput = Readonly<{
  sessionId: string;
  endedAt: number;
  recordedDurationMs: number;
  lametagFrame: Uint8Array<ArrayBuffer>;
  finalFrame: Uint8Array<ArrayBuffer>;
  speakerActivityLog: SpeakerActivityLog | null;
}>;

export type FinalizedCallRecordingFile = Readonly<{
  filePath: string;
  pcmPath: string;
  metadataPath: string;
  speakerActivityPath?: string;
}>;

export type AbortCallRecordingFileInput = Readonly<{
  sessionId: string;
}>;

export type AbortedCallRecordingFile = Readonly<{
  partialPath: string;
}>;

export type CallRecordingFileOperationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{
      ok: false;
      error: string;
      partialPath: string;
    }>;
