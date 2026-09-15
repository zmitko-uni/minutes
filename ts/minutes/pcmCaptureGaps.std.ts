// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { WHISPER_PCM_SAMPLE_RATE } from './whisperAudioPrep.std.ts';

/**
 * Dropped capture buffers land in the recording as exact zeros, which real
 * microphone or playout audio practically never produces for long stretches.
 * Anything at or above this share of the recording means audio was lost, not
 * that the participants were quiet.
 */
export const PCM_CAPTURE_GAP_WARNING_RATIO = 0.25;

/** Shorter zero runs are ordinary silence between words, not a lost buffer. */
const MIN_GAP_SECONDS = 0.25;

export type PcmCaptureGapReport = Readonly<{
  /** 0..1 share of the recording made up of long runs of exact zeros. */
  gapRatio: number;
  longestGapMs: number;
}>;

export function measurePcmCaptureGaps(
  pcm: Float32Array,
  sampleRate = WHISPER_PCM_SAMPLE_RATE
): PcmCaptureGapReport {
  if (pcm.length === 0 || sampleRate <= 0) {
    return { gapRatio: 0, longestGapMs: 0 };
  }

  const minGapSamples = Math.max(1, Math.round(sampleRate * MIN_GAP_SECONDS));
  let gapSamples = 0;
  let longestGapSamples = 0;
  let runLength = 0;

  for (let index = 0; index <= pcm.length; index += 1) {
    if (index < pcm.length && pcm[index] === 0) {
      runLength += 1;
      continue;
    }
    if (runLength >= minGapSamples) {
      gapSamples += runLength;
      longestGapSamples = Math.max(longestGapSamples, runLength);
    }
    runLength = 0;
  }

  return {
    gapRatio: gapSamples / pcm.length,
    longestGapMs: Math.round((longestGapSamples / sampleRate) * 1000),
  };
}

export function isPcmCaptureSeverelyDamaged(
  report: PcmCaptureGapReport
): boolean {
  return report.gapRatio >= PCM_CAPTURE_GAP_WARNING_RATIO;
}

export function formatPcmCaptureGapWarning(
  report: PcmCaptureGapReport
): string {
  const lostPercent = Math.round(report.gapRatio * 100);
  return (
    `> ⚠️ **Nahrávka je poškozená — ${lostPercent} % zvuku se nezachytilo** ` +
    '(místo zvuku je v nahrávce digitální ticho). Přepis proto pokrývá jen ' +
    'zbytek hovoru. Typická příčina je minimalizované okno Minutes během ' +
    'hovoru ve starší verzi aplikace — aktualizujte Minutes a nahrajte hovor ' +
    'znovu.'
  );
}
