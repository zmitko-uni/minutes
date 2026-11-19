// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { VideoFrameSource } from '@signalapp/ringrtc';
import {
  FRAME_BUFFER_SIZE,
  MAX_FRAME_HEIGHT,
  MAX_FRAME_WIDTH,
} from '../calling/constants.std.ts';

type Key = number | undefined;
type Kind = 'camera' | 'presentation';
type Dimensions = [number, number];
type BufferType = Uint8Array<ArrayBuffer>;

type Slot = {
  readonly kind: Kind;
  readonly source: VideoFrameSource;
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;
  image?: ImageData;
  at: number;
  dirty: boolean;
  pendingForDisplay: boolean;
  discardForRecording: boolean;
};

const CAMERA_FRAME_MAX_AGE_MS = 3_000;

export class RecordingIncomingVideo {
  readonly #slots = new Map<Key, Slot>();
  readonly #getSource: (key: Key) => VideoFrameSource | undefined;
  readonly #now: () => number;
  readonly #createCanvas: () => HTMLCanvasElement;
  #buffer: BufferType | undefined;

  constructor(options: {
    getSource: (key: Key) => VideoFrameSource | undefined;
    now?: () => number;
    createCanvas?: () => HTMLCanvasElement;
  }) {
    this.#getSource = options.getSource;
    this.#now = options.now ?? (() => performance.now());
    this.#createCanvas =
      options.createCanvas ?? (() => document.createElement('canvas'));
  }

  setTargets(targets: ReadonlyMap<Key, Kind>): void {
    for (const key of this.#slots.keys()) {
      if (!targets.has(key)) {
        this.#slots.delete(key);
      }
    }
    for (const [key, kind] of targets) {
      const previous = this.#slots.get(key);
      if (previous?.kind === kind) {
        continue;
      }
      this.#slots.delete(key);
      const source = this.#getSource(key);
      if (!source) {
        continue;
      }
      const canvas = this.#createCanvas();
      const context = canvas.getContext('2d');
      if (!context) {
        continue;
      }
      this.#slots.set(key, {
        kind,
        source,
        canvas,
        context,
        at: -Infinity,
        dirty: false,
        pendingForDisplay: false,
        // RingRTC uses the same track for camera and screen share. Don't use
        // the frame that may still be queued from the previous media kind.
        discardForRecording: previous !== undefined,
      });
    }
  }

  poll(): void {
    if (this.#slots.size === 0) {
      return;
    }
    this.#buffer ??= new Uint8Array(FRAME_BUFFER_SIZE);
    const buffer = this.#buffer;
    for (const [key, slot] of this.#slots) {
      const dims = slot.source.receiveVideoFrame(
        buffer,
        MAX_FRAME_WIDTH,
        MAX_FRAME_HEIGHT
      );
      if (dims) {
        this.#remember(key, dims, buffer, true);
      }
    }
  }

  readForDisplay(
    key: Key,
    source: VideoFrameSource,
    buffer: BufferType,
    maxWidth: number,
    maxHeight: number
  ): Dimensions | undefined {
    const slot = this.#slots.get(key);
    const dims = source.receiveVideoFrame(buffer, maxWidth, maxHeight);
    if (!slot) {
      return dims;
    }
    if (dims) {
      slot.pendingForDisplay = false;
      this.#remember(key, dims, buffer, false);
      return dims;
    }
    if (slot.pendingForDisplay && slot.image) {
      slot.pendingForDisplay = false;
      const { data, width, height } = slot.image;
      if (
        Math.min(width, height) <= Math.min(maxWidth, maxHeight) &&
        Math.max(width, height) <= Math.max(maxWidth, maxHeight) &&
        data.length <= buffer.length
      ) {
        buffer.set(data);
        return [width, height];
      }
    }
    return undefined;
  }

  getCanvas(key: Key): HTMLCanvasElement | undefined {
    const slot = this.#slots.get(key);
    if (
      !slot?.image ||
      (slot.kind === 'camera' &&
        this.#now() - slot.at > CAMERA_FRAME_MAX_AGE_MS)
    ) {
      return undefined;
    }
    if (slot.dirty) {
      const { canvas, context, image } = slot;
      if (canvas.width !== image.width) {
        canvas.width = image.width;
      }
      if (canvas.height !== image.height) {
        canvas.height = image.height;
      }
      context.putImageData(image, 0, 0);
      slot.dirty = false;
    }
    return slot.canvas;
  }

  clear(): void {
    this.#slots.clear();
    this.#buffer = undefined;
  }

  #remember(
    key: Key,
    [width, height]: Dimensions,
    buffer: BufferType,
    forDisplay: boolean
  ): void {
    const count = width * height * 4;
    const slot = this.#slots.get(key);
    if (!slot || width < 2 || height < 2 || count > buffer.length) {
      return;
    }
    if (slot.discardForRecording) {
      slot.discardForRecording = false;
      return;
    }
    const now = this.#now();
    const sameSize =
      slot.image?.width === width && slot.image.height === height;
    if (!forDisplay && sameSize && now - slot.at < 1000 / 20) {
      return;
    }
    if (!sameSize) {
      slot.image = slot.context.createImageData(width, height);
    }
    slot.image?.data.set(buffer.subarray(0, count));
    slot.at = now;
    slot.dirty = true;
    slot.pendingForDisplay = forDisplay;
  }
}
