// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

// Runs whisper-cpp-node inside an Electron utility process (bundles/workers/minutesWhisper.js).
// A separate process is used so the main app can stop a running transcription
// immediately: the native whisper call cannot be interrupted in-process, but the
// utility process can be killed.

import type { WhisperDecodeParams } from './whisperTranscribeSettings.std.ts';

export type WhisperWorkerRequest = Readonly<{
  type: 'transcribe';
  modelPath: string;
  useGpu: boolean;
  gpuDeviceIndex: number;
  threadCount: number;
  language: string;
  prompt: string;
  profile: WhisperDecodeParams;
  useVad: boolean;
  vadModelPath: string;
  pcmf32: Float32Array;
}>;

export type WhisperWorkerSegment = Readonly<{
  start: string;
  end: string;
  text: string;
}>;

export type WhisperWorkerMessage =
  | Readonly<{ type: 'progress'; percent: number }>
  | Readonly<{
      type: 'done';
      segments: ReadonlyArray<WhisperWorkerSegment>;
      language?: string;
    }>
  | Readonly<{ type: 'error'; message: string }>;

type WhisperCppNodeModule = typeof import('whisper-cpp-node');

function loadWhisperCppNode(): WhisperCppNodeModule {
  // oxlint-disable-next-line typescript/no-var-requires
  const mod = require('whisper-cpp-node') as WhisperCppNodeModule;
  return mod.default != null
    ? (mod.default as unknown as WhisperCppNodeModule)
    : mod;
}

function post(message: WhisperWorkerMessage): void {
  process.parentPort.postMessage(message);
}

async function transcribe(request: WhisperWorkerRequest): Promise<void> {
  const { createWhisperContext, transcribeAsync } = loadWhisperCppNode();

  const ctx = createWhisperContext({
    model: request.modelPath,
    use_gpu: request.useGpu,
    flash_attn: request.useGpu,
    gpu_device: request.useGpu ? request.gpuDeviceIndex : undefined,
    no_prints: true,
  });

  try {
    const result = await transcribeAsync(ctx, {
      pcmf32: request.pcmf32,
      language: request.language,
      translate: false,
      detect_language: false,
      temperature: request.profile.temperature,
      prompt: request.prompt,
      split_on_word: true,
      max_len: 0,
      beam_size: request.profile.beam_size,
      best_of: request.profile.best_of,
      n_threads: request.threadCount,
      progress_callback: (percent: number) => {
        post({ type: 'progress', percent });
      },
      vad: request.useVad,
      vad_model: request.useVad ? request.vadModelPath : undefined,
      vad_threshold: 0.45,
      vad_min_speech_duration_ms: 120,
      vad_min_silence_duration_ms: 80,
      vad_speech_pad_ms: 180,
    });

    post({
      type: 'done',
      segments: result.segments.map(segment => ({
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
      })),
      language: result.language,
    });
  } finally {
    ctx.free();
  }
}

process.parentPort.on('message', event => {
  const request = event.data as WhisperWorkerRequest;
  if (request?.type !== 'transcribe') {
    return;
  }
  transcribe(request).catch((error: unknown) => {
    post({
      type: 'error',
      message:
        error instanceof Error ? error.message : 'Whisper selhal v procesu.',
    });
  });
});
