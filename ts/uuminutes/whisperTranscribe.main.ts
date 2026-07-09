// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { cpus } from 'node:os';
import { join } from 'node:path';
import { stat } from 'node:fs/promises';

import { app } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { MODELS_DIR_NAME } from './constants.std.ts';
import { normalizePcmForWhisper } from './whisperAudioPrep.std.ts';
import {
  DEFAULT_WHISPER_LANGUAGE,
  DEFAULT_WHISPER_PROMPT,
  WHISPER_DECODE_PROFILES,
  WHISPER_VAD_MODEL_FILE,
  WHISPER_VAD_MODEL_MIN_BYTES,
} from './whisperSettings.std.ts';

const log = createLogger('uuminutes/whisper');

type WhisperCppNodeModule = typeof import('whisper-cpp-node');

export type WhisperRuntimeStatus = Readonly<{
  ready: boolean;
  error?: string;
}>;

export type TranscribePcmOptions = Readonly<{
  modelPath: string;
  pcmf32: Float32Array;
  language?: string;
  prompt?: string;
  onProgress?: (percent: number) => void;
}>;

export type TranscribePcmResult = Readonly<{
  text: string;
  segments: ReadonlyArray<Readonly<{ start: string; end: string; text: string }>>;
  language?: string;
}>;

let runtimeChecked = false;
let runtimeReady = false;
let runtimeError: string | undefined;
let vadModelReady: boolean | null = null;

function loadWhisperCppNode(): WhisperCppNodeModule {
  // oxlint-disable-next-line typescript/no-var-requires
  const mod = require('whisper-cpp-node') as WhisperCppNodeModule;
  return mod.default != null
    ? (mod.default as unknown as WhisperCppNodeModule)
    : mod;
}

export function resetWhisperRuntimeCheck(): void {
  runtimeChecked = false;
  runtimeReady = false;
  runtimeError = undefined;
  vadModelReady = null;
}

export async function checkWhisperRuntime(): Promise<WhisperRuntimeStatus> {
  if (runtimeChecked) {
    return { ready: runtimeReady, error: runtimeError };
  }

  runtimeChecked = true;
  try {
    const mod = loadWhisperCppNode();
    if (typeof mod.createWhisperContext !== 'function') {
      throw new Error('whisper-cpp-node is missing createWhisperContext');
    }
    runtimeReady = true;
    log.info('whisper-cpp-node runtime is available');
    return { ready: true };
  } catch (error) {
    runtimeError =
      error instanceof Error ? error.message : 'whisper-cpp-node failed to load';
    log.error(`whisper runtime check failed: ${runtimeError}`);
    return { ready: false, error: runtimeError };
  }
}

export function getVadModelPath(): string {
  return join(app.getPath('userData'), MODELS_DIR_NAME, WHISPER_VAD_MODEL_FILE);
}

export async function isVadModelReady(): Promise<boolean> {
  if (vadModelReady != null) {
    return vadModelReady;
  }
  try {
    const fileStat = await stat(getVadModelPath());
    vadModelReady = fileStat.size >= WHISPER_VAD_MODEL_MIN_BYTES;
  } catch {
    vadModelReady = false;
  }
  return vadModelReady;
}

function looksWeakTranscript(text: string, durationSamples: number): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return true;
  }
  const minChars = Math.max(4, Math.floor(durationSamples / 16_000 / 4));
  return trimmed.length < minChars;
}

async function transcribeOnce(
  options: TranscribePcmOptions & {
    pcmf32: Float32Array;
    profile: (typeof WHISPER_DECODE_PROFILES)[number];
    useVad: boolean;
  }
): Promise<TranscribePcmResult> {
  const { createWhisperContext, transcribeAsync } = loadWhisperCppNode();

  const ctx = createWhisperContext({
    model: options.modelPath,
    use_gpu: true,
    no_prints: true,
  });

  try {
    const vadModelPath = getVadModelPath();
    const result = await transcribeAsync(ctx, {
      pcmf32: options.pcmf32,
      language: options.language ?? DEFAULT_WHISPER_LANGUAGE,
      translate: false,
      detect_language: false,
      temperature: options.profile.temperature,
      prompt: options.prompt ?? DEFAULT_WHISPER_PROMPT,
      split_on_word: true,
      max_len: 0,
      beam_size: options.profile.beam_size,
      best_of: options.profile.best_of,
      n_threads: Math.max(2, Math.min(8, cpus().length)),
      progress_callback: options.onProgress,
      vad: options.useVad,
      vad_model: options.useVad ? vadModelPath : undefined,
      vad_threshold: 0.45,
      vad_min_speech_duration_ms: 120,
      vad_min_silence_duration_ms: 80,
      vad_speech_pad_ms: 180,
    });

    const segments = result.segments.map(segment => ({
      start: segment.start,
      end: segment.end,
      text: segment.text.trim(),
    }));

    const text = segments
      .map(segment => segment.text)
      .filter(Boolean)
      .join('\n')
      .trim();

    return {
      text,
      segments,
      language: result.language,
    };
  } finally {
    ctx.free();
  }
}

export async function transcribePcm(
  options: TranscribePcmOptions
): Promise<TranscribePcmResult> {
  const runtime = await checkWhisperRuntime();
  if (!runtime.ready) {
    throw new Error(
      runtime.error ??
        'Lokální Whisper není k dispozici. Zkuste znovu nainstalovat rozšíření.'
    );
  }

  const prepared = normalizePcmForWhisper(options.pcmf32);
  const useVad = await isVadModelReady();

  let bestResult: TranscribePcmResult | null = null;

  for (const profile of WHISPER_DECODE_PROFILES) {
    const result = await transcribeOnce({
      ...options,
      pcmf32: prepared,
      profile,
      useVad,
    });

    if (
      !bestResult ||
      result.text.length > bestResult.text.length ||
      (looksWeakTranscript(bestResult.text, prepared.length) &&
        !looksWeakTranscript(result.text, prepared.length))
    ) {
      bestResult = result;
    }

    if (!looksWeakTranscript(result.text, prepared.length)) {
      return result;
    }
  }

  return (
    bestResult ?? {
      text: '',
      segments: [],
    }
  );
}
