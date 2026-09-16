// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { RendererMessageType } from '../types/AudioRecorder.std.ts';
import { configureRingRtcRecordingAudioContext } from './ringRtcAudioContext.std.ts';
import { RingRtcPcmChunker } from './ringRtcPcmChunker.std.ts';
import { RECORDING_PCM_SAMPLE_RATE } from './speakerActivity.std.ts';

const log = createLogger('minutes/callRecorder');

const MAX_QUEUED_BYTES = 8 * 1024 * 1024;

export type MinutesWorkletMessage = Readonly<
  | {
      type: 'chunk';
      chunk: Uint8Array<ArrayBuffer>;
    }
  | {
      type: 'pcm';
      samples: Float32Array<ArrayBuffer>;
    }
  | {
      type: 'complete';
      lametagFrame: Uint8Array<ArrayBuffer>;
      finalFrame: Uint8Array<ArrayBuffer>;
    }
>;

export type CallRecordingStopResult = Readonly<{
  recordedDurationMs: number;
  lametagFrame: Uint8Array<ArrayBuffer>;
  finalFrame: Uint8Array<ArrayBuffer>;
}>;

export type CallRecordingStreamSink = Readonly<{
  appendMp3(data: Uint8Array<ArrayBuffer>): Promise<void>;
  appendPcm(samples: Float32Array<ArrayBuffer>): Promise<void>;
}>;

let contextPromise: Promise<AudioContext> | undefined;

async function initContext(): Promise<AudioContext> {
  const context = new AudioContext({ sampleRate: 48_000 });
  await configureRingRtcRecordingAudioContext(context);
  await context.audioWorklet.addModule('bundles/workers/minutesMp3Encoder.js');
  return context;
}

type PendingWrite =
  | Readonly<{ kind: 'mp3'; data: Uint8Array<ArrayBuffer> }>
  | Readonly<{ kind: 'pcm'; samples: Float32Array<ArrayBuffer> }>;

type ActiveState = Readonly<{
  sources: Array<MediaStreamAudioSourceNode>;
  streams: Array<MediaStream>;
  worklet: AudioWorkletNode;
  merger?: ChannelMergerNode;
  context: AudioContext;
  sessionId: string;
  sink: CallRecordingStreamSink;
  onPcm?: (sampleCount: number) => void;
  onFatalError?: (error: Error) => void;
  pcmChunker: RingRtcPcmChunker;
  recordedPcmSamples: number;
  writeQueue: Array<PendingWrite>;
  queuedBytes: number;
  drainPromise?: Promise<void>;
  stopPromise: Promise<CallRecordingStopResult>;
  resolveStop: (value: CallRecordingStopResult) => void;
  rejectStop: (error: Error) => void;
}>;

type State =
  | Readonly<{ type: 'idle' }>
  | (ActiveState & Readonly<{ type: 'running' }>)
  | (ActiveState & Readonly<{ type: 'paused' }>);

/**
 * Records one or more MediaStreams into a streaming MP3 session using Signal's
 * lame-based audio worklet. Supports pause / resume without finalizing.
 */
export class CallRecorder {
  #state: State = { type: 'idle' };

  static async warmup(): Promise<void> {
    if (contextPromise == null) {
      contextPromise = initContext();
    }
    await contextPromise;
  }

  #connectSources(active: ActiveState): void {
    const { sources, worklet, merger } = active;
    if (sources.length === 1) {
      sources[0]!.connect(worklet);
      return;
    }
    if (merger) {
      sources.forEach((source, index) => {
        source.connect(merger, 0, index);
      });
      merger.connect(worklet);
    }
  }

  #disconnectSources(active: ActiveState): void {
    for (const source of active.sources) {
      source.disconnect();
    }
    active.merger?.disconnect();
  }

  #signalFatal(active: ActiveState, error: Error): void {
    active.onFatalError?.(error);
    active.rejectStop(error);
  }

  #enqueueWrite(active: ActiveState, write: PendingWrite): void {
    const byteLength =
      write.kind === 'mp3' ? write.data.byteLength : write.samples.byteLength;
    if (active.queuedBytes + byteLength > MAX_QUEUED_BYTES) {
      this.#signalFatal(
        active,
        new Error('Call recording renderer queue exceeded its memory limit')
      );
      return;
    }
    active.writeQueue.push(write);
    active.queuedBytes += byteLength;
    active.drainPromise ??= this.#drainWrites(active);
  }

  async #drainWrites(active: ActiveState): Promise<void> {
    try {
      while (active.writeQueue.length > 0) {
        const next = active.writeQueue.shift();
        if (!next) {
          break;
        }
        const byteLength =
          next.kind === 'mp3'
            ? next.data.byteLength
            : next.samples.byteLength;
        try {
          if (next.kind === 'mp3') {
            await active.sink.appendMp3(next.data);
          } else {
            await active.sink.appendPcm(next.samples);
          }
        } finally {
          active.queuedBytes -= byteLength;
        }
      }
    } catch (error) {
      active.writeQueue = [];
      active.queuedBytes = 0;
      this.#signalFatal(
        active,
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      active.drainPromise = undefined;
      if (active.writeQueue.length > 0 && this.#state.type !== 'idle') {
        active.drainPromise = this.#drainWrites(active);
      }
    }
  }

  async #waitForPendingWrites(active: ActiveState): Promise<void> {
    const pending = active.drainPromise;
    if (pending) {
      await pending;
    }
    if (active.drainPromise && active.drainPromise !== pending) {
      await this.#waitForPendingWrites(active);
    }
  }

  async start(
    streams: ReadonlyArray<MediaStream>,
    options: Readonly<{
      sessionId: string;
      sink: CallRecordingStreamSink;
      onPcm?: (sampleCount: number) => void;
      onFatalError?: (error: Error) => void;
    }>
  ): Promise<boolean> {
    if (this.#state.type !== 'idle') {
      throw new Error('CallRecorder already started');
    }

    const audioStreams = streams.filter(
      stream => stream.getAudioTracks().length > 0
    );
    if (audioStreams.length === 0) {
      log.warn('start: no audio tracks in provided streams');
      return false;
    }

    if (contextPromise == null) {
      contextPromise = initContext();
    }
    const context = await contextPromise;

    const worklet = new AudioWorkletNode(context, 'minutes-mp3-encoder', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      channelCount: 2,
      channelCountMode: 'max',
    });

    const { promise, resolve, reject } =
      Promise.withResolvers<CallRecordingStopResult>();

    const pcmChunker = new RingRtcPcmChunker();

    const active: ActiveState = {
      sources: [],
      streams: [],
      worklet,
      context,
      sessionId: options.sessionId,
      sink: options.sink,
      onPcm: options.onPcm,
      onFatalError: options.onFatalError,
      pcmChunker,
      recordedPcmSamples: 0,
      writeQueue: [],
      queuedBytes: 0,
      stopPromise: promise,
      resolveStop: resolve,
      rejectStop: reject,
    };

    worklet.port.onmessage = ({ data }: { data: MinutesWorkletMessage }) => {
      if (this.#state.type === 'idle') {
        return;
      }
      const state = this.#state as ActiveState;
      if (data.type === 'chunk') {
        this.#enqueueWrite(state, { kind: 'mp3', data: data.chunk });
        return;
      }
      if (data.type === 'pcm') {
        state.recordedPcmSamples += data.samples.length;
        options.onPcm?.(data.samples.length);
        for (const chunk of pcmChunker.add(data.samples)) {
          this.#enqueueWrite(state, { kind: 'pcm', samples: chunk });
        }
        return;
      }
      if (data.type === 'complete') {
        void this.#waitForPendingWrites(state).then(() => {
          const flushed = pcmChunker.flush();
          if (flushed != null) {
            state.recordedPcmSamples += flushed.length;
            this.#enqueueWrite(state, { kind: 'pcm', samples: flushed });
          }
          void this.#waitForPendingWrites(state).then(() => {
            const recordedDurationMs = Math.round(
              (state.recordedPcmSamples / RECORDING_PCM_SAMPLE_RATE) * 1000
            );
            state.resolveStop({
              recordedDurationMs,
              lametagFrame: data.lametagFrame,
              finalFrame: data.finalFrame,
            });
          });
        });
      }
    };

    const sources = audioStreams.map(stream =>
      context.createMediaStreamSource(stream)
    );

    let merger: ChannelMergerNode | undefined;
    if (sources.length > 1) {
      merger = context.createChannelMerger(sources.length);
    }

    active.sources = sources;
    active.streams = [...audioStreams];
    active.merger = merger;

    this.#connectSources(active);
    this.#state = { type: 'running', ...active };

    log.info(`start: recording ${audioStreams.length} audio stream(s)`);
    return true;
  }

  pause(): boolean {
    if (this.#state.type !== 'running') {
      return false;
    }
    this.#disconnectSources(this.#state);
    const active = this.#state;
    this.#state = { ...active, type: 'paused' };
    return true;
  }

  resume(): boolean {
    if (this.#state.type !== 'paused') {
      return false;
    }
    this.#connectSources(this.#state);
    const active = this.#state;
    this.#state = { ...active, type: 'running' };
    return true;
  }

  isActive(): boolean {
    return this.#state.type === 'running' || this.#state.type === 'paused';
  }

  getSessionId(): string | undefined {
    if (this.#state.type === 'idle') {
      return undefined;
    }
    return this.#state.sessionId;
  }

  async stop(): Promise<CallRecordingStopResult | undefined> {
    if (this.#state.type !== 'running' && this.#state.type !== 'paused') {
      return undefined;
    }

    const active = this.#state;
    this.#disconnectSources(active);
    active.worklet.port.postMessage({
      type: 'stop',
    } satisfies RendererMessageType);

    for (const stream of active.streams) {
      stream.getTracks().forEach(track => track.stop());
    }

    const result = await active.stopPromise;
    this.#state = { type: 'idle' };
    return result;
  }
}
