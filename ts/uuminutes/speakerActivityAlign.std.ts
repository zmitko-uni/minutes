// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  LOCAL_SPEAKER_ID,
  resolveSpeakerDisplayName,
  type AlignedTranscriptSegment,
  type SpeakerActivityLog,
} from './speakerActivity.std.ts';

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

function pickDominantSpeakerId(
  activityLog: SpeakerActivityLog,
  startMs: number,
  endMs: number
): string | null {
  const speakingSamples = new Map<string, number>();
  const levelTotals = new Map<string, number>();
  let latestSpeakerTime = -Infinity;
  let latestSpeakerTimeId: string | null = null;

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

    for (const entry of sample.levels) {
      const speaking =
        entry.speaking ?? entry.level > 0;
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

  let winner: string | null = null;
  let bestSpeakingSamples = 0;
  for (const [id, count] of speakingSamples) {
    if (count > bestSpeakingSamples) {
      bestSpeakingSamples = count;
      winner = id;
    }
  }

  if (winner != null && bestSpeakingSamples > 0) {
    const tied = [...speakingSamples.entries()]
      .filter(([, count]) => count === bestSpeakingSamples)
      .map(([id]) => id);
    if (tied.length === 1) {
      return winner;
    }
    if (latestSpeakerTimeId != null && tied.includes(latestSpeakerTimeId)) {
      return latestSpeakerTimeId;
    }
    let bestLevel = 0;
    for (const id of tied) {
      const total = levelTotals.get(id) ?? 0;
      if (total > bestLevel) {
        bestLevel = total;
        winner = id;
      }
    }
    return winner;
  }

  let bestLevel = 0;
  for (const [id, total] of levelTotals) {
    if (total > bestLevel) {
      bestLevel = total;
      winner = id;
    }
  }

  return winner;
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
        speakerId =
          pickDominantSpeakerId(activityLog, startMs, endMs) ?? speakerId;
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
