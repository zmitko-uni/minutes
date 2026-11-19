// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { PresentationSourceController } from './presentationSourceController.std.ts';
import { recordingVideoBridge } from './recordingVideoBridge.std.ts';
import {
  RecordingVideoScene,
  type RecordingCallVideoSnapshot,
} from './recordingVideoScene.dom.ts';
import { RingRtcOutgoingVideoSource } from './ringRtcOutgoingVideoSource.preload.ts';
import { ScreenShareCompositor } from './screenShareCompositor.dom.ts';

type VideoSourceLifecycle = Readonly<{
  start(): void;
  pause(): void;
  resume(): void;
  stop(): void;
}>;

type CanvasCompositor = Readonly<{
  start(): unknown;
  pause(): void;
  resume(): void;
  stop(): void;
}>;

export class RingRtcScreenShareCompositor {
  readonly #source: VideoSourceLifecycle;
  readonly #compositor: CanvasCompositor;
  #canvasStopped = false;
  #sourceStopped = false;

  constructor(source: VideoSourceLifecycle, compositor: CanvasCompositor) {
    this.#source = source;
    this.#compositor = compositor;
  }

  static isSupported(): boolean {
    return RingRtcOutgoingVideoSource.isSupported();
  }

  static create(options: {
    conversationId: string;
    readSnapshot(): RecordingCallVideoSnapshot | undefined;
    onFatalError: (error: Error) => void;
  }): RingRtcScreenShareCompositor {
    const localPresentation =
      new PresentationSourceController<HTMLCanvasElement>();
    const outgoing = RingRtcOutgoingVideoSource.create({
      ...options,
      controller: localPresentation,
    });
    const scene = new RecordingVideoScene({
      conversationId: options.conversationId,
      bridge: recordingVideoBridge,
      localPresentation,
      readSnapshot: options.readSnapshot,
    });
    const activate = (startOutgoing: () => void) => {
      scene.start();
      try {
        startOutgoing();
      } catch (error) {
        scene.stop();
        throw error;
      }
    };
    const deactivate = (stopOutgoing: () => void) => {
      try {
        stopOutgoing();
      } finally {
        scene.stop();
      }
    };
    return new RingRtcScreenShareCompositor(
      {
        start: () => activate(() => outgoing.start()),
        pause: () => deactivate(() => outgoing.pause()),
        resume: () => activate(() => outgoing.resume()),
        stop: () => deactivate(() => outgoing.stop()),
      },
      new ScreenShareCompositor(scene)
    );
  }

  start(): unknown {
    this.#source.start();
    try {
      return this.#compositor.start();
    } catch (error) {
      this.#source.stop();
      this.#sourceStopped = true;
      throw error;
    }
  }

  pause(): void {
    try {
      this.#compositor.pause();
    } finally {
      this.#source.pause();
    }
  }

  resume(): void {
    this.#source.resume();
    this.#compositor.resume();
  }

  stop(): void {
    if (this.#canvasStopped && this.#sourceStopped) {
      return;
    }

    let firstError: Error | undefined;
    if (!this.#canvasStopped) {
      try {
        this.#compositor.stop();
        this.#canvasStopped = true;
      } catch (error) {
        firstError = toError(error);
      }
    }
    if (!this.#sourceStopped) {
      try {
        this.#source.stop();
        this.#sourceStopped = true;
      } catch (error) {
        firstError ??= toError(error);
      }
    }
    if (firstError) {
      throw firstError;
    }
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
