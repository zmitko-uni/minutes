// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type AudioTapOptions = Readonly<{
  /**
   * Called with interleaved Float32 PCM captured from system audio output.
   */
  onData: (
    samples: Float32Array<ArrayBuffer>,
    sampleRate: number,
    channels: number
  ) => void;

  /**
   * Called with lifecycle events:
   * - `'started'` — capture is running.
   * - `'error'` — capture failed or stopped abnormally; `message` explains.
   */
  onEvent: (type: 'started' | 'error', message: string) => void;
}>;

/**
 * `true` when running on macOS 13.0+ with the native addon available.
 */
export function isSupported(): boolean;

/**
 * Start capturing system audio. Only one tap can be active at a time.
 * Requires the Screen Recording permission (TCC); the first call triggers
 * the system prompt and delivers an `'error'` event until it is granted.
 */
export function start(options: AudioTapOptions): void;

/**
 * Stop capturing. Safe to call when not started or unsupported.
 */
export function stop(): void;
