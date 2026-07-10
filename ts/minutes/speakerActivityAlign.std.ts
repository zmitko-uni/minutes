// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  LOCAL_SPEAKER_ID,
  MULTIPLE_VOICES_SPEAKER_ID,
  resolveSpeakerDisplayName,
  type AlignedTranscriptSegment,
  type SpeakerActivityLog,
} from './speakerActivity.std.ts';

/** Share of in-range samples where 2+ speakers talk at once → „více hlasů“. */
const CONCURRENT_SPEECH_SAMPLE_RATIO = 0.28;

/** Min. relative gap between top-2 speakers to pick a single winner. */
const DOMINANT_SPEAKER_MARGIN = 0.22;

export function parseWhisperTimestampToMs(timestamp: string): number {
  const match = timestamp.trim().match(/^(\d+):(\d+):(\d+)[,.](\d+)$/);
  if (!match) {
    return 0;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const millisPart = match[4] ?? '0';
  const millis = Number(millisPart.padEnd(3, '0').slice(0, 3));
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

type SpeakerPickResult = Readonly<{
  speakerId: string;
  multipleVoices: boolean;
}>;

function countActiveSpeakersInSample(
  sample: SpeakerActivityLog['samples'][number]
): number {
  let count = 0;
  for (const entry of sample.levels) {
    if (entry.speaking ?? entry.level > 0) {
      count += 1;
    }
  }
  return count;
}

function pickSpeakerForSegment(
  activityLog: SpeakerActivityLog,
  startMs: number,
  endMs: number
): SpeakerPickResult {
  const speakingSamples = new Map<string, number>();
  const levelTotals = new Map<string, number>();
  let latestSpeakerTime = -Infinity;
  let latestSpeakerTimeId: string | null = null;
  let samplesInRange = 0;
  let concurrentSpeechSamples = 0;

  const segmentStartWall =
    activityLog.recordingStartedAt > 0
      ? activityLog.recordingStartedAt + startMs
      : undefined;
  const segmentEndWall =
    activityLog.recordingStartedAt > 0
      ? activityLog.recordingStartedAt + endMs
      : undefined;

  for (const sample of activityLog.samples) {
    if (sample.tMs < startMs - activityLog.sampleIntervalMs) {
      continue;
    }
    if (sample.tMs > endMs + activityLog.sampleIntervalMs) {
      continue;
    }

    samplesInRange += 1;
    const activeInSample = countActiveSpeakersInSample(sample);
    if (activeInSample >= 2) {
      concurrentSpeechSamples += 1;
    }

    for (const entry of sample.levels) {
      const speaking = entry.speaking ?? entry.level > 0;
      if (speaking) {
        speakingSamples.set(
          entry.id,
          (speakingSamples.get(entry.id) ?? 0) + 1
        );
      }
      levelTotals.set(entry.id, (levelTotals.get(entry.id) ?? 0) + entry.level);

      if (
        entry.speakerTime != null &&
        segmentStartWall != null &&
        segmentEndWall != null &&
        entry.speakerTime >= segmentStartWall &&
        entry.speakerTime <= segmentEndWall &&
        entry.speakerTime >= latestSpeakerTime
      ) {
        latestSpeakerTime = entry.speakerTime;
        latestSpeakerTimeId = entry.id;
      }
    }
  }

  if (
    samplesInRange > 0 &&
    concurrentSpeechSamples / samplesInRange >= CONCURRENT_SPEECH_SAMPLE_RATIO
  ) {
    return {
      speakerId: MULTIPLE_VOICES_SPEAKER_ID,
      multipleVoices: true,
    };
  }

  const rankedSpeakers = [...speakingSamples.entries()].sort(
    (left, right) => right[1] - left[1]
  );
  const [topSpeaker, topCount] = rankedSpeakers[0] ?? [null, 0];
  const [, secondCount] = rankedSpeakers[1] ?? [null, 0];

  if (
    topSpeaker != null &&
    topCount > 0 &&
    secondCount > 0 &&
    secondCount / topCount >= 1 - DOMINANT_SPEAKER_MARGIN
  ) {
    return {
      speakerId: MULTIPLE_VOICES_SPEAKER_ID,
      multipleVoices: true,
    };
  }

  let winner: string | null = topSpeaker;
  const bestSpeakingSamples = topCount;

  if (winner != null && bestSpeakingSamples > 0) {
    const tied = rankedSpeakers
      .filter(([, count]) => count === bestSpeakingSamples)
      .map(([id]) => id);
    if (tied.length === 1) {
      return { speakerId: winner, multipleVoices: false };
    }
    if (latestSpeakerTimeId != null && tied.includes(latestSpeakerTimeId)) {
      return { speakerId: latestSpeakerTimeId, multipleVoices: false };
    }
    let bestLevel = 0;
    for (const id of tied) {
      const total = levelTotals.get(id) ?? 0;
      if (total > bestLevel) {
        bestLevel = total;
        winner = id;
      }
    }
    return { speakerId: winner ?? LOCAL_SPEAKER_ID, multipleVoices: false };
  }

  let bestLevel = 0;
  for (const [id, total] of levelTotals) {
    if (total > bestLevel) {
      bestLevel = total;
      winner = id;
    }
  }

  return {
    speakerId: winner ?? LOCAL_SPEAKER_ID,
    multipleVoices: false,
  };
}

export function alignWhisperSegmentsWithSpeakerActivity(
  segments: ReadonlyArray<
    Readonly<{ start: string; end: string; text: string }>
  >,
  activityLog: SpeakerActivityLog | null | undefined,
  options?: { localSpeakerDisplayName?: string }
): Array<AlignedTranscriptSegment> {
  const fallbackIndexById = new Map<string, number>();

  return segments
    .filter(segment => segment.text.trim().length > 0)
    .map(segment => {
      const startMs = parseWhisperTimestampToMs(segment.start);
      const endMs = parseWhisperTimestampToMs(segment.end);

      let speakerId = LOCAL_SPEAKER_ID;
      if (activityLog && activityLog.samples.length > 0) {
        speakerId = pickSpeakerForSegment(activityLog, startMs, endMs).speakerId;
      }

      const speakerLabel = activityLog
        ? resolveSpeakerDisplayName(speakerId, activityLog, {
            localSpeakerDisplayName: options?.localSpeakerDisplayName,
            fallbackIndexById,
          })
        : 'Neznámý';

      return {
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
        speakerLabel,
        speakerId,
      };
    });
}

export function formatAlignedSegmentsForDisplay(
  segments: ReadonlyArray<AlignedTranscriptSegment>
): string {
  return segments
    .map(
      segment =>
        `**[${segment.start} – ${segment.end} | ${segment.speakerLabel}]** ${segment.text}`
    )
    .join('\n\n');
}

export function formatAlignedSegmentsForAi(
  segments: ReadonlyArray<AlignedTranscriptSegment>
): string {
  return segments
    .map(segment => `[${segment.speakerLabel}]: ${segment.text}`)
    .join('\n\n');
}

/** Heuristic: full-file transcript looks too short for the audio duration. */
export function isFullFileTranscriptSuspiciouslyWeak(
  text: string,
  pcmDurationMs: number
): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0 || pcmDurationMs <= 0) {
    return true;
  }

  const durationSec = pcmDurationMs / 1000;
  const charsPerSecond = trimmed.length / Math.max(durationSec, 1);
  if (charsPerSecond >= 4) {
    return false;
  }

  const minChars = Math.max(4, Math.floor(durationSec / 5));
  return trimmed.length < minChars;
}
