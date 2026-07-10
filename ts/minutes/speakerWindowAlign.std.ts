// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  LOCAL_SPEAKER_ID,
  type SpeakerActivityLog,
  type SpeakerActivitySample,
} from './speakerActivity.std.ts';

export const WHISPER_PCM_SAMPLE_RATE = 16_000;

export type SpeakerWindow = Readonly<{
  startMs: number;
  endMs: number;
  speakerId: string;
}>;

export function formatMsAsWhisperTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  const pad2 = (value: number) => String(value).padStart(2, '0');
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)},${String(millis).padStart(3, '0')}`;
}

function dominantSpeakerAtSample(
  sample: SpeakerActivitySample
): string | null {
  let winner: string | null = null;
  let bestLevel = 0;

  for (const entry of sample.levels) {
    const speaking = entry.speaking ?? entry.level > 0;
    if (!speaking) {
      continue;
    }
    if (entry.level > bestLevel) {
      bestLevel = entry.level;
      winner = entry.id;
    }
  }

  return winner;
}

function mergeShortWindows(
  windows: Array<SpeakerWindow>,
  minWindowMs: number
): Array<SpeakerWindow> {
  if (windows.length <= 1) {
    return windows;
  }

  const merged: Array<SpeakerWindow> = [];
  for (const window of windows) {
    const duration = window.endMs - window.startMs;
    const previous = merged.at(-1);
    if (
      previous &&
      duration < minWindowMs &&
      previous.speakerId === window.speakerId
    ) {
      merged[merged.length - 1] = {
        ...previous,
        endMs: window.endMs,
      };
      continue;
    }
    if (duration < minWindowMs && previous) {
      merged[merged.length - 1] = {
        ...previous,
        endMs: window.endMs,
      };
      continue;
    }
    merged.push(window);
  }

  return merged;
}

export function buildSpeakerWindows(
  activityLog: SpeakerActivityLog,
  options?: Readonly<{ minWindowMs?: number; silenceGapMs?: number }>
): Array<SpeakerWindow> {
  const minWindowMs = options?.minWindowMs ?? 700;
  const silenceGapMs = options?.silenceGapMs ?? 450;
  const stepMs = activityLog.sampleIntervalMs;

  const raw: Array<SpeakerWindow> = [];
  let current: SpeakerWindow | null = null;
  let lastActiveMs: number | null = null;

  for (const sample of activityLog.samples) {
    const speaker = dominantSpeakerAtSample(sample);
    const tMs = sample.tMs;

    if (speaker == null) {
      if (
        current &&
        lastActiveMs != null &&
        tMs - lastActiveMs > silenceGapMs
      ) {
        raw.push(current);
        current = null;
      } else if (current != null) {
        current = {
          startMs: current.startMs,
          endMs: tMs + stepMs,
          speakerId: current.speakerId,
        };
      }
      continue;
    }

    lastActiveMs = tMs;

    if (current == null || current.speakerId !== speaker) {
      if (current) {
        raw.push(current);
      }
      current = {
        startMs: tMs,
        endMs: tMs + stepMs,
        speakerId: speaker,
      };
    } else {
      current = { ...current, endMs: tMs + stepMs };
    }
  }

  if (current) {
    raw.push(current);
  }

  return mergeShortWindows(raw, minWindowMs).filter(
    window => window.endMs - window.startMs >= 400
  );
}

export function slicePcmForWindow(
  pcmf32: Float32Array,
  startMs: number,
  endMs: number,
  sampleRate: number = WHISPER_PCM_SAMPLE_RATE,
  paddingMs = 280
): Float32Array {
  const paddedStartMs = Math.max(0, startMs - paddingMs);
  const paddedEndMs = endMs + paddingMs;
  const startSample = Math.max(
    0,
    Math.floor((paddedStartMs / 1000) * sampleRate)
  );
  const endSample = Math.min(
    pcmf32.length,
    Math.ceil((paddedEndMs / 1000) * sampleRate)
  );
  if (endSample <= startSample) {
    return new Float32Array(0);
  }
  return pcmf32.slice(startSample, endSample);
}

export function countDistinctSpeakersInLog(
  activityLog: SpeakerActivityLog
): number {
  const ids = new Set<string>();
  for (const sample of activityLog.samples) {
    const speaker = dominantSpeakerAtSample(sample);
    if (speaker && speaker !== LOCAL_SPEAKER_ID) {
      ids.add(speaker);
    }
  }
  if (
    activityLog.samples.some(
      sample => dominantSpeakerAtSample(sample) === LOCAL_SPEAKER_ID
    )
  ) {
    ids.add(LOCAL_SPEAKER_ID);
  }
  return ids.size;
}
