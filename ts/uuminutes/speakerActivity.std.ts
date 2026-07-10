// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { CallMode } from '../types/CallDisposition.std.ts';

export const SPEAKER_ACTIVITY_LOG_VERSION = 1;

export const SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS = 250;

export const LOCAL_SPEAKER_ID = 'local';

export const REMOTE_SPEAKER_ID = 'remote';

export type SpeakerParticipantInfo = Readonly<{
  displayName: string;
  aci?: string;
  demuxId?: number;
  isLocal: boolean;
}>;

/** Same truncated level Signal stores in Redux (see truncateAudioLevel). */
export type SpeakerActivityLevel = Readonly<{
  id: string;
  level: number;
  /** True when level > 0 — same rule as CallingAudioIndicator in Signal UI. */
  speaking: boolean;
  /** RingRTC last-spoke timestamp for remote group participants. */
  speakerTime?: number;
}>;

export type SpeakerActivitySample = Readonly<{
  /** Milliseconds from start of recorded audio (excludes paused time). */
  tMs: number;
  levels: ReadonlyArray<SpeakerActivityLevel>;
}>;

export type SpeakerActivityLog = Readonly<{
  version: typeof SPEAKER_ACTIVITY_LOG_VERSION;
  conversationId: string;
  callMode: CallMode.Direct | CallMode.Group;
  /** Wall-clock ms when recording started (for mapping RingRTC speakerTime). */
  recordingStartedAt: number;
  recordingDurationMs: number;
  sampleIntervalMs: number;
  participants: Readonly<Record<string, SpeakerParticipantInfo>>;
  samples: ReadonlyArray<SpeakerActivitySample>;
}>;

export type AlignedTranscriptSegment = Readonly<{
  start: string;
  end: string;
  text: string;
  speakerLabel: string;
  speakerId: string;
}>;

/** Keep activity samples within actual PCM length so speaker windows cannot outlive audio. */
export function clampSpeakerActivityLogToPcmDuration(
  log: SpeakerActivityLog,
  pcmDurationMs: number
): SpeakerActivityLog {
  if (!Number.isFinite(pcmDurationMs) || pcmDurationMs <= 0) {
    return log;
  }

  const samples = log.samples.filter(sample => sample.tMs < pcmDurationMs);
  return {
    ...log,
    recordingDurationMs: Math.min(log.recordingDurationMs, pcmDurationMs),
    samples,
  };
}
