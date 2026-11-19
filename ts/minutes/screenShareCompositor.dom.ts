// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ActivePresentationSource } from './presentationSourceRegistry.std.ts';

import {
  calculateAspectFit,
  decidePresentationFrame,
  VIDEO_OUTPUT_SIZE,
  type VideoSize,
} from './videoRecordingPrimitives.std.ts';

export const SCREEN_SHARE_FRAME_RATE = 15;

export type PresentationCanvasSource = HTMLCanvasElement | HTMLVideoElement;

export type RecordingGalleryTile = Readonly<{
  name: string;
  speaking: boolean;
  camera?: PresentationCanvasSource;
}>;

export type PresentationSourceProvider = Readonly<{
  getActiveSource():
    | ActivePresentationSource<PresentationCanvasSource>
    | undefined;
  getGallery?(): ReadonlyArray<RecordingGalleryTile>;
}>;

export type ScreenShareCompositorDependencies = Readonly<{
  createCanvas(): HTMLCanvasElement;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}>;

const DEFAULT_DEPENDENCIES: ScreenShareCompositorDependencies = {
  createCanvas: () => document.createElement('canvas'),
  setInterval: (callback, intervalMs) =>
    window.setInterval(callback, intervalMs),
  clearInterval: handle => window.clearInterval(handle as number),
};

export class ScreenShareCompositor {
  readonly #registry: PresentationSourceProvider;

  readonly #canvas: HTMLCanvasElement;

  readonly #context: CanvasRenderingContext2D;

  readonly #dependencies: ScreenShareCompositorDependencies;

  #timer: unknown;

  #stream: MediaStream | undefined;

  #state: 'idle' | 'running' | 'paused' | 'stopped' = 'idle';

  constructor(
    registry: PresentationSourceProvider,
    dependencies: ScreenShareCompositorDependencies = DEFAULT_DEPENDENCIES
  ) {
    this.#registry = registry;
    this.#dependencies = dependencies;
    this.#canvas = dependencies.createCanvas();
    this.#canvas.width = VIDEO_OUTPUT_SIZE.width;
    this.#canvas.height = VIDEO_OUTPUT_SIZE.height;

    const context = this.#canvas.getContext('2d');
    if (!context) {
      throw new Error('Screen-share compositor requires a 2D canvas context');
    }
    this.#context = context;
  }

  public start(): MediaStream {
    if (this.#state !== 'idle') {
      throw new Error('Screen-share compositor has already started');
    }

    if (typeof this.#canvas.captureStream !== 'function') {
      throw new Error('Canvas stream capture is not supported');
    }

    this.#renderFrame();
    const stream = this.#canvas.captureStream(SCREEN_SHARE_FRAME_RATE);
    this.#stream = stream;
    this.#scheduleFrames();
    this.#state = 'running';
    return stream;
  }

  public pause(): void {
    if (this.#state !== 'running') {
      return;
    }

    this.#clearScheduledFrames();
    this.#state = 'paused';
  }

  public resume(): void {
    if (this.#state !== 'paused') {
      return;
    }

    this.#renderFrame();
    this.#scheduleFrames();
    this.#state = 'running';
  }

  public stop(): void {
    if (this.#state === 'stopped') {
      return;
    }

    this.#clearScheduledFrames();
    this.#stream?.getTracks().forEach(track => track.stop());
    this.#state = 'stopped';
  }

  #scheduleFrames(): void {
    this.#timer = this.#dependencies.setInterval(
      () => this.#renderFrame(),
      1000 / SCREEN_SHARE_FRAME_RATE
    );
  }

  #clearScheduledFrames(): void {
    if (this.#timer === undefined) {
      return;
    }

    this.#dependencies.clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #renderFrame(): void {
    this.#context.fillStyle = '#000000';
    this.#context.fillRect(
      0,
      0,
      VIDEO_OUTPUT_SIZE.width,
      VIDEO_OUTPUT_SIZE.height
    );

    const activeSource = this.#registry.getActiveSource();
    if (!activeSource) {
      this.#renderGallery();
      return;
    }

    const decision = decidePresentationFrame({
      sourceId: activeSource.identity,
      generation: activeSource.presentationGeneration,
      readyGeneration: activeSource.presentationGeneration,
      size: getSourceSize(activeSource.source),
    });
    if (decision.kind === 'black') {
      this.#renderGallery();
      return;
    }

    const { x, y, width, height } = decision.destination;
    this.#context.drawImage(activeSource.source, x, y, width, height);
  }

  #renderGallery(): void {
    const tiles = this.#registry.getGallery?.();
    if (!tiles?.length) {
      return;
    }

    const context = this.#context;
    const gap = 12;
    const columns = Math.ceil(Math.sqrt(tiles.length));
    const rows = Math.ceil(tiles.length / columns);
    const { width, height } = VIDEO_OUTPUT_SIZE;
    const tileWidth = (width - (columns + 1) * gap) / columns;
    const tileHeight = (height - (rows + 1) * gap) / rows;
    const labelHeight = Math.min(50, Math.round(tileHeight * 0.27));
    const cameraHeight = tileHeight - labelHeight;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    tiles.forEach(({ camera, name, speaking }, index) => {
      const row = Math.floor(index / columns);
      const tilesInRow = Math.min(columns, tiles.length - row * columns);
      const rowWidth = tilesInRow * (tileWidth + gap) - gap;
      const x = (width - rowWidth) / 2 + (index % columns) * (tileWidth + gap);
      const y = gap + row * (tileHeight + gap);
      const middle = x + tileWidth / 2;

      context.fillStyle = speaking ? '#42d392' : '#303440';
      context.fillRect(x, y, tileWidth, tileHeight);
      context.fillStyle = speaking ? '#203b34' : '#222631';
      context.fillRect(x + 4, y + 4, tileWidth - 8, tileHeight - 8);

      const cameraRect =
        camera &&
        calculateAspectFit(getSourceSize(camera), {
          width: tileWidth - 8,
          height: cameraHeight - 4,
        });
      if (camera && cameraRect) {
        context.drawImage(
          camera,
          x + 4 + cameraRect.x,
          y + 4 + cameraRect.y,
          cameraRect.width,
          cameraRect.height
        );
      } else {
        const initials =
          name
            .trim()
            .split(/\s+/u)
            .slice(0, 2)
            .map(word => Array.from(word)[0] ?? '')
            .join('')
            .toUpperCase() || '?';
        context.fillStyle = '#e3e7ef';
        context.font = `600 ${Math.min(86, cameraHeight / 3)}px sans-serif`;
        context.fillText(
          initials,
          middle,
          y + cameraHeight / 2,
          tileWidth - 16
        );
      }

      context.fillStyle = '#f6f8fd';
      context.font = `500 ${Math.min(25, labelHeight * 0.6)}px sans-serif`;
      context.fillText(
        name,
        middle,
        y + cameraHeight + labelHeight / 2,
        tileWidth - 16
      );
    });
  }
}

function getSourceSize(source: PresentationCanvasSource): VideoSize {
  const video = source as Partial<HTMLVideoElement>;
  if (
    typeof video.videoWidth === 'number' &&
    typeof video.videoHeight === 'number'
  ) {
    return { width: video.videoWidth, height: video.videoHeight };
  }

  const canvas = source as HTMLCanvasElement;
  return { width: canvas.width, height: canvas.height };
}
