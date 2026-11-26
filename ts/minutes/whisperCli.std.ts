// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { WhisperDecodeParams } from './whisperTranscribeSettings.std.ts';

export type WhisperCliRequest = Readonly<{
  modelPath: string;
  useGpu: boolean;
  gpuDeviceIndex: number;
  threadCount: number;
  language: string;
  prompt: string;
  profile: WhisperDecodeParams;
  useVad: boolean;
  vadModelPath: string;
}>;

export type WhisperCliSegment = Readonly<{
  start: string;
  end: string;
  text: string;
}>;

export type WhisperCliResult = Readonly<{
  segments: ReadonlyArray<WhisperCliSegment>;
  language?: string;
}>;

const SAMPLE_RATE = 16000;
const WAV_HEADER_BYTES = 44;
const PROGRESS_PATTERN = /progress\s*=\s*(\d+)%/;

export function buildWhisperCliArgs(
  request: WhisperCliRequest,
  wavPath: string,
  outputBase: string
): Array<string> {
  const args = [
    '-m',
    request.modelPath,
    '-f',
    wavPath,
    '-l',
    request.language,
    '-t',
    String(request.threadCount),
    '-tp',
    String(request.profile.temperature),
    '-bs',
    String(request.profile.beam_size),
    '-bo',
    String(request.profile.best_of),
    '--prompt',
    request.prompt,
    '-sow',
    '-oj',
    '-of',
    outputBase,
    '-pp',
    '-np',
  ];
  if (request.useGpu) {
    args.push('-dev', String(request.gpuDeviceIndex), '-fa');
  } else {
    args.push('-ng', '-nfa');
  }
  if (request.useVad) {
    args.push(
      '--vad',
      '-vm',
      request.vadModelPath,
      '-vt',
      '0.45',
      '-vspd',
      '120',
      '-vsd',
      '80',
      '-vp',
      '180'
    );
  }
  return args;
}

export function parseWhisperCliProgress(line: string): number | null {
  const match = PROGRESS_PATTERN.exec(line);
  return match == null ? null : Number(match[1]);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function parseWhisperCliJson(json: unknown): WhisperCliResult {
  const { transcription, result } = (json ?? {}) as {
    transcription?: unknown;
    result?: { language?: unknown };
  };
  if (!Array.isArray(transcription)) {
    throw new Error('whisper-cli: neplatný JSON výstup');
  }
  const segments = transcription
    .map(
      (item: {
        timestamps?: { from?: unknown; to?: unknown };
        text?: unknown;
      }): WhisperCliSegment => ({
        start: asString(item?.timestamps?.from),
        end: asString(item?.timestamps?.to),
        text: typeof item?.text === 'string' ? item.text.trim() : '',
      })
    )
    .filter(segment => segment.text !== '');
  const language =
    typeof result?.language === 'string' ? result.language : undefined;
  return { segments, language };
}

export function encodePcmF32ToWav16k(
  pcmf32: Float32Array
): Uint8Array<ArrayBuffer> {
  const dataBytes = pcmf32.length * 2;
  const bytes = new Uint8Array(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(bytes.buffer);
  const writeTag = (offset: number, tag: string): void => {
    for (let i = 0; i < tag.length; i += 1) {
      view.setUint8(offset + i, tag.charCodeAt(i));
    }
  };
  writeTag(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeTag(8, 'WAVE');
  writeTag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeTag(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcmf32.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, pcmf32[i] ?? 0));
    view.setInt16(
      WAV_HEADER_BYTES + i * 2,
      clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767),
      true
    );
  }
  return bytes;
}
