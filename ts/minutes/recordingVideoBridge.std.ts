// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { VideoFrameSource, VideoRequest } from '@signalapp/ringrtc';

type IncomingKey = number | undefined;

type Backend = Readonly<{
  requestGroupVideo(
    conversationId: string,
    requests: Array<VideoRequest>,
    speakerHeight: number
  ): void;
  getIncomingSource(
    conversationId: string,
    key: IncomingKey
  ): VideoFrameSource | undefined;
  isOutgoingSender(conversationId: string, sender: object): boolean;
}>;

type CaptureConsumer = Readonly<{
  readForDisplay?(
    key: IncomingKey,
    source: VideoFrameSource,
    ...args: Parameters<VideoFrameSource['receiveVideoFrame']>
  ): ReturnType<VideoFrameSource['receiveVideoFrame']>;
  onLocalCamera?(frame: VideoFrame): void;
}>;

type UiVideoRequest = Readonly<{
  requests: Array<VideoRequest>;
  speakerHeight: number;
}>;

type ActiveCapture = {
  readonly conversationId: string;
  readonly consumer: CaptureConsumer;
  requests: ReadonlyArray<VideoRequest>;
};

export type RecordingVideoCapture = Readonly<{
  setGroupRequests(requests: ReadonlyArray<VideoRequest>): void;
  stop(): void;
}>;

export class RecordingVideoBridge {
  #backend: Backend | undefined;
  #active: ActiveCapture | undefined;
  readonly #uiRequests = new Map<string, UiVideoRequest>();

  bind(backend: Backend): void {
    this.#backend = backend;
  }

  requestFromUi(
    conversationId: string,
    requests: Array<VideoRequest>,
    speakerHeight: number
  ): void {
    this.#uiRequests.set(conversationId, { requests, speakerHeight });
    this.#sendGroupRequests(conversationId);
  }

  forgetCall(conversationId: string): void {
    this.#uiRequests.delete(conversationId);
  }

  startCapture(
    conversationId: string,
    consumer: CaptureConsumer
  ): RecordingVideoCapture {
    if (this.#active) {
      throw new Error('A call video capture is already active');
    }
    const active: ActiveCapture = { conversationId, consumer, requests: [] };
    this.#active = active;
    return {
      setGroupRequests: requests => {
        if (
          this.#active !== active ||
          requestsEqual(active.requests, requests)
        ) {
          return;
        }
        active.requests = requests;
        this.#sendGroupRequests(conversationId);
      },
      stop: () => {
        if (this.#active === active) {
          this.#active = undefined;
          if (active.requests.length > 0) {
            this.#sendGroupRequests(conversationId);
          }
        }
      },
    };
  }

  getIncomingSource(
    conversationId: string,
    key: IncomingKey
  ): VideoFrameSource | undefined {
    return this.#backend?.getIncomingSource(conversationId, key);
  }

  wrapDisplaySource(
    conversationId: string,
    key: IncomingKey,
    source: VideoFrameSource
  ): VideoFrameSource {
    return {
      receiveVideoFrame: (...args) => {
        const active = this.#active;
        if (
          active?.conversationId === conversationId &&
          active.consumer.readForDisplay
        ) {
          return active.consumer.readForDisplay(key, source, ...args);
        }
        return source.receiveVideoFrame(...args);
      },
    };
  }

  onSentCameraFrame(sender: object, frame: VideoFrame): void {
    const active = this.#active;
    if (
      active?.consumer.onLocalCamera &&
      this.#backend?.isOutgoingSender(active.conversationId, sender)
    ) {
      active.consumer.onLocalCamera(frame);
    }
  }

  #sendGroupRequests(conversationId: string): void {
    const ui = this.#uiRequests.get(conversationId);
    const recording =
      this.#active?.conversationId === conversationId
        ? this.#active.requests
        : [];
    if (recording.length === 0) {
      this.#backend?.requestGroupVideo(
        conversationId,
        ui?.requests ?? [],
        ui?.speakerHeight ?? 0
      );
      return;
    }

    const requests = new Map(
      ui?.requests.map(request => [request.demuxId, request])
    );
    for (const request of recording) {
      const existing = requests.get(request.demuxId);
      requests.set(
        request.demuxId,
        existing
          ? {
              demuxId: request.demuxId,
              width: Math.max(existing.width, request.width),
              height: Math.max(existing.height, request.height),
              framerate: existing.framerate ?? request.framerate,
            }
          : request
      );
    }
    this.#backend?.requestGroupVideo(
      conversationId,
      [...requests.values()],
      ui?.speakerHeight ?? 0
    );
  }
}

function requestsEqual(
  a: ReadonlyArray<VideoRequest>,
  b: ReadonlyArray<VideoRequest>
): boolean {
  return (
    a.length === b.length &&
    a.every(({ demuxId, width, height }, i) => {
      const other = b[i];
      return (
        other?.demuxId === demuxId &&
        other.width === width &&
        other.height === height
      );
    })
  );
}

export const recordingVideoBridge = new RecordingVideoBridge();
