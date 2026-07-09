// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AlignedTranscriptSegment,
  SpeakerActivityLog,
} from './speakerActivity.std.ts';
import { alignWhisperSegmentsWithSpeakerActivity } from './speakerActivityAlign.std.ts';
import {
  buildSpeakerWindows,
  formatMsAsWhisperTimestamp,
  slicePcmForWindow,
} from './speakerWindowAlign.std.ts';
import { buildChainedWhisperPrompt } from './whisperAudioPrep.std.ts';
import {
  transcribePcm,
  type TranscribePcmResult,
} from './whisperTranscribe.main.ts';
import { DEFAULT_WHISPER_LANGUAGE } from './whisperSettings.std.ts';

function resolveSpeakerLabel(
  speakerId: string,
  activityLog: SpeakerActivityLog,
  fallbackIndexById: Map<string, number>
): string {
  const known = activityLog.participants[speakerId]?.displayName;
  if (known && known.length > 0) {
    return known;
  }
  if (speakerId === 'local') {
    return 'Já';
  }
  if (!fallbackIndexById.has(speakerId)) {
    fallbackIndexById.set(speakerId, fallbackIndexById.size + 1);
  }
  return `Řečník ${fallbackIndexById.get(speakerId)}`;
}

export async function transcribePcmWithSpeakerWindows(options: {
  modelPath: string;
  pcmf32: Float32Array;
  activityLog: SpeakerActivityLog;
  language?: string;
  prompt?: string;
  onProgress?: (percent: number) => void;
}): Promise<TranscribePcmResult & { alignedSegments: Array<AlignedTranscriptSegment> }> {
  const windows = buildSpeakerWindows(options.activityLog);
  const fallbackIndexById = new Map<string, number>();
  const alignedSegments: Array<AlignedTranscriptSegment> = [];
  let chainedPrompt = options.prompt;

  if (windows.length === 0) {
    const result = await transcribePcm({
      modelPath: options.modelPath,
      pcmf32: options.pcmf32,
      language: options.language ?? DEFAULT_WHISPER_LANGUAGE,
      prompt: chainedPrompt,
      onProgress: options.onProgress,
    });
    const aligned = alignWhisperSegmentsWithSpeakerActivity(
      result.segments,
      options.activityLog
    );
    return { ...result, alignedSegments: aligned };
  }

  let completed = 0;
  for (const window of windows) {
    const chunk = slicePcmForWindow(
      options.pcmf32,
      window.startMs,
      window.endMs
    );
    if (chunk.length < 16_000 * 0.35) {
      completed += 1;
      options.onProgress?.(Math.round((completed / windows.length) * 100));
      continue;
    }

    const chunkResult = await transcribePcm({
      modelPath: options.modelPath,
      pcmf32: chunk,
      language: options.language ?? DEFAULT_WHISPER_LANGUAGE,
      prompt: chainedPrompt,
    });

    const text = chunkResult.text.trim();
    if (text.length > 0) {
      alignedSegments.push({
        start: formatMsAsWhisperTimestamp(window.startMs),
        end: formatMsAsWhisperTimestamp(window.endMs),
        text,
        speakerId: window.speakerId,
        speakerLabel: resolveSpeakerLabel(
          window.speakerId,
          options.activityLog,
          fallbackIndexById
        ),
      });
      chainedPrompt = buildChainedWhisperPrompt(text);
    }

    completed += 1;
    options.onProgress?.(Math.round((completed / windows.length) * 100));
  }

  const text = alignedSegments.map(segment => segment.text).join('\n\n').trim();

  return {
    text,
    segments: alignedSegments.map(segment => ({
      start: segment.start,
      end: segment.end,
      text: segment.text,
    })),
    alignedSegments,
  };
}
