// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import * as macAudioTap from '@minutes/mac-audio-tap';

import { createLogger } from '../logging/log.std.ts';
import { drop } from '../util/drop.std.ts';

const log = createLogger('minutes/macLoopbackAudio');

// Chrome-only API, thus a declaration (see ts/util/desktopCapturer.preload.ts
// for the video variant).
declare class MediaStreamTrackGenerator extends MediaStreamTrack {
  constructor(options: { kind: 'audio' });

  public writable: WritableStream<AudioData>;
}

// Covers ScreenCaptureKit display enumeration and stream startup; a denied
// Screen Recording permission fails much faster than this.
const START_TIMEOUT_MS = 10_000;

type ActiveTap = {
  track: MediaStreamTrackGenerator;
  writer: WritableStreamDefaultWriter<AudioData>;
  framesWritten: number;
};

let activeTap: ActiveTap | undefined;

async function closeWriter(
  writer: WritableStreamDefaultWriter<AudioData>
): Promise<void> {
  try {
    await writer.close();
  } catch {
    // already closed or errored
  }
}

async function writeAudioData(tap: ActiveTap, data: AudioData): Promise<void> {
  try {
    await tap.writer.write(data);
  } catch {
    if (activeTap === tap) {
      stopMacLoopbackAudio();
    }
  }
}

export function stopMacLoopbackAudio(): void {
  if (window.platform !== 'darwin') {
    return;
  }
  macAudioTap.stop();

  const tap = activeTap;
  activeTap = undefined;
  if (tap == null) {
    return;
  }
  drop(closeWriter(tap.writer));
}

/**
 * macOS counterpart of the Windows `desktopCapturer` loopback stream: system
 * audio captured natively with ScreenCaptureKit and exposed as a MediaStream.
 * Returns null when unsupported or when the Screen Recording permission is
 * missing — the recording then degrades to microphone-only, same as the
 * Windows path when no loopback source exists.
 */
export async function getMacLoopbackAudioStream(): Promise<MediaStream | null> {
  if (window.platform !== 'darwin') {
    return null;
  }
  if (!macAudioTap.isSupported()) {
    log.warn('system audio capture unsupported (requires macOS 13+)');
    return null;
  }

  if (activeTap != null) {
    log.warn('previous tap still active; stopping it');
    stopMacLoopbackAudio();
  }

  const track = new MediaStreamTrackGenerator({ kind: 'audio' });
  const writer = track.writable.getWriter();
  const tap: ActiveTap = { track, writer, framesWritten: 0 };

  const { promise: started, resolve, reject } = Promise.withResolvers<void>();

  try {
    macAudioTap.start({
      onData: (samples, sampleRate, channels) => {
        if (activeTap !== tap) {
          return;
        }
        if (track.readyState === 'ended') {
          stopMacLoopbackAudio();
          return;
        }

        const numberOfFrames = samples.length / channels;
        const data = new AudioData({
          format: 'f32',
          sampleRate,
          numberOfFrames,
          numberOfChannels: channels,
          timestamp: Math.round((tap.framesWritten / sampleRate) * 1e6),
          data: samples,
        });
        tap.framesWritten += numberOfFrames;

        drop(writeAudioData(tap, data));
      },
      onEvent: (type, message) => {
        if (type === 'started') {
          resolve();
          return;
        }
        log.warn(`tap event ${type}: ${message}`);
        if (activeTap === tap) {
          stopMacLoopbackAudio();
        }
        reject(new Error(message || type));
      },
    });
  } catch (error) {
    log.warn('failed to start audio tap', error);
    drop(closeWriter(writer));
    return null;
  }

  activeTap = tap;

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      started,
      new Promise<never>((_resolve, timeoutReject) => {
        timer = setTimeout(
          () => timeoutReject(new Error('timed out waiting for system audio')),
          START_TIMEOUT_MS
        );
      }),
    ]);
  } catch (error) {
    log.warn('system audio unavailable; recording microphone only', error);
    if (activeTap === tap) {
      stopMacLoopbackAudio();
    }
    return null;
  } finally {
    clearTimeout(timer);
  }

  const stream = new MediaStream();
  stream.addTrack(track);
  return stream;
}
