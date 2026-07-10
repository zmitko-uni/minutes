// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type {
  AlignedTranscriptSegment,
  SpeakerActivityLog,
} from './speakerActivity.std.ts';
import { resolveSpeakerDisplayName } from './speakerActivity.std.ts';
import { alignWhisperSegmentsWithSpeakerActivity } from './speakerActivityAlign.std.ts';
import {
  buildSpeakerWindows,
  formatMsAsWhisperTimestamp,
  slicePcmForWindow,
  WHISPER_PCM_SAMPLE_RATE,
} from './speakerWindowAlign.std.ts';
import { buildChainedWhisperPrompt } from './whisperAudioPrep.std.ts';
import {
  transcribePcm,
  type TranscribePcmResult,
  type WhisperTranscribeRuntimeOptions,
} from './whisperTranscribe.main.ts';
import { DEFAULT_WHISPER_LANGUAGE } from './whisperSettings.std.ts';
import { throwIfTranscriptionCancelled } from './transcriptionCancel.main.ts';

export async function transcribePcmWithSpeakerWindows(options: {
  modelPath: string;
  pcmf32: Float32Array;
  activityLog: SpeakerActivityLog;
  language?: string;
  prompt?: string;
  background?: boolean;
  jobId?: string;
  localSpeakerDisplayName?: string;
  runtime?: WhisperTranscribeRuntimeOptions;
  onProgress?: (percent: number, detail?: string) => void;
}): Promise<TranscribePcmResult & { alignedSegments: Array<AlignedTranscriptSegment> }> {
  const pcmDurationMs =
    (options.pcmf32.length / WHISPER_PCM_SAMPLE_RATE) * 1000;
  const windows = buildSpeakerWindows(options.activityLog).filter(
    window => window.startMs < pcmDurationMs
  );
  const fallbackIndexById = new Map<string, number>();
  const alignedSegments: Array<AlignedTranscriptSegment> = [];
  let chainedPrompt = options.prompt;

  if (windows.length === 0) {
    const result = await transcribePcm({
      modelPath: options.modelPath,
      pcmf32: options.pcmf32,
      language: options.language ?? DEFAULT_WHISPER_LANGUAGE,
      prompt: chainedPrompt,
      background: options.background,
      jobId: options.jobId,
      runtime: options.runtime,
      onProgress: options.onProgress,
    });
    const aligned = alignWhisperSegmentsWithSpeakerActivity(
      result.segments,
      options.activityLog,
      { localSpeakerDisplayName: options.localSpeakerDisplayName }
    );
    return { ...result, alignedSegments: aligned };
  }

  let completed = 0;
  for (const window of windows) {
    throwIfTranscriptionCancelled(options.jobId);

    const chunk = slicePcmForWindow(
      options.pcmf32,
      window.startMs,
      window.endMs
    );
    if (chunk.length < 16_000 * 0.35) {
      completed += 1;
      options.onProgress?.(
        Math.round((completed / windows.length) * 100),
        `Úsek ${completed}/${windows.length} (krátký, přeskočeno)`
      );
      continue;
    }

    const windowLabel = resolveSpeakerDisplayName(
      window.speakerId,
      options.activityLog,
      {
        localSpeakerDisplayName: options.localSpeakerDisplayName,
        fallbackIndexById,
      }
    );

    const chunkResult = await transcribePcm({
      modelPath: options.modelPath,
      pcmf32: chunk,
      language: options.language ?? DEFAULT_WHISPER_LANGUAGE,
      prompt: chainedPrompt,
      background: options.background,
      jobId: options.jobId,
      runtime: options.runtime,
      onProgress: (chunkPercent, chunkDetail) => {
        const windowBase = ((completed + chunkPercent / 100) / windows.length) * 100;
        options.onProgress?.(
          Math.round(windowBase),
          chunkDetail
            ? `Úsek ${completed + 1}/${windows.length} · ${windowLabel} — ${chunkDetail}`
            : `Úsek ${completed + 1}/${windows.length} · ${windowLabel}`
        );
      },
    });

    const text = chunkResult.text.trim();
    if (text.length > 0) {
      alignedSegments.push({
        start: formatMsAsWhisperTimestamp(window.startMs),
        end: formatMsAsWhisperTimestamp(window.endMs),
        text,
        speakerId: window.speakerId,
        speakerLabel: resolveSpeakerDisplayName(
          window.speakerId,
          options.activityLog,
          {
            localSpeakerDisplayName: options.localSpeakerDisplayName,
            fallbackIndexById,
          }
        ),
      });
      chainedPrompt = buildChainedWhisperPrompt(text);
    }

    completed += 1;
    options.onProgress?.(
      Math.round((completed / windows.length) * 100),
      `Úsek ${completed}/${windows.length} hotovo`
    );
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
