// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { preparePcmForWhisper } from './whisperAudioPrep.std.ts';

/**
 * Decodes MP3 via Web Audio (no ffmpeg) and returns 16 kHz mono float32 PCM
 * suitable for whisper.cpp.
 */
export async function mp3ToWhisperPcm(
  mp3Data: Uint8Array
): Promise<Float32Array> {
  const context = new AudioContext();
  try {
    const arrayBuffer = mp3Data.buffer.slice(
      mp3Data.byteOffset,
      mp3Data.byteOffset + mp3Data.byteLength
    ) as ArrayBuffer;
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const mono = mixToMono(audioBuffer);
    return preparePcmForWhisper(mono, audioBuffer.sampleRate);
  } finally {
    await context.close();
  }
}

function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer.getChannelData(0).slice();
  }

  const left = audioBuffer.getChannelData(0);
  const right = audioBuffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i += 1) {
    mono[i] = ((left[i] ?? 0) + (right[i] ?? 0)) / 2;
  }
  return mono;
}
