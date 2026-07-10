// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { RendererMessageType } from '../types/AudioRecorder.std.ts';
import { Encoder } from '@signalapp/lame';

declare const sampleRate: number;

type AudioWorkletProcessor = Readonly<{
  port: MessagePort;
}>;

declare const AudioWorkletProcessor: {
  prototype: AudioWorkletProcessor;
  new (): AudioWorkletProcessor;
};

type AudioWorkletProcessorImpl = Readonly<{
  process: (inputs: Array<Array<Float32Array<ArrayBuffer>>>) => boolean;
}> &
  AudioWorkletProcessor;

type AudioWorkletProcessorConstructor = Readonly<{
  new (): AudioWorkletProcessorImpl;
}>;

declare function registerProcessor(
  name: string,
  processorCtor: AudioWorkletProcessorConstructor
): void;

type MinutesEncoderWorkletMessage = Readonly<
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

/** Higher bitrate than voice notes — call recording needs both sides audible. */
const BIT_RATE = 192;
const Q = 4;

class MinutesMp3Encoder
  extends AudioWorkletProcessor
  implements AudioWorkletProcessorImpl
{
  readonly #encoder = new Encoder({
    q: Q,
    sampleRate,
    bitRate: BIT_RATE,
  });
  #isStopped = false;

  constructor() {
    super();

    this.port.onmessage = ({ data }: { data: RendererMessageType }) => {
      if (data.type !== 'stop') {
        throw new Error('Unexpected message');
      }
      if (this.#isStopped) {
        throw new Error('Already stopped');
      }
      this.#isStopped = true;

      const chunk = new Uint8Array(this.#encoder.flush());
      const lametagFrame = new Uint8Array(this.#encoder.getLametagFrame());
      this.port.postMessage(
        {
          type: 'complete',
          lametagFrame,
          finalFrame: chunk,
        } satisfies MinutesEncoderWorkletMessage,
        [lametagFrame.buffer, chunk.buffer]
      );
    };
  }

  #mixInputChannels(
    input: ReadonlyArray<Float32Array<ArrayBuffer>>
  ): Float32Array<ArrayBuffer> | null {
    const [first] = input;
    if (first == null) {
      return null;
    }
    if (input.length === 1) {
      return first;
    }

    const mixed = new Float32Array(first.length);
    for (const channel of input) {
      for (let i = 0; i < mixed.length; i += 1) {
        mixed[i] = (mixed[i] ?? 0) + (channel[i] ?? 0) / input.length;
      }
    }
    return mixed;
  }

  process(inputs: Array<Array<Float32Array<ArrayBuffer>>>): boolean {
    if (this.#isStopped) {
      return false;
    }

    const [input] = inputs;
    if (input == null) {
      throw new Error(`Invalid input count: ${inputs.length}`);
    }

    const mixed = this.#mixInputChannels(input);
    if (mixed == null) {
      return true;
    }

    const pcmCopy = mixed.slice();
    this.port.postMessage(
      {
        type: 'pcm',
        samples: pcmCopy,
      } satisfies MinutesEncoderWorkletMessage,
      [pcmCopy.buffer]
    );

    const shared = this.#encoder.encode(mixed);
    if (shared.length === 0) {
      return true;
    }

    const copy = new Uint8Array(shared);
    this.port.postMessage(
      {
        type: 'chunk',
        chunk: copy,
      } satisfies MinutesEncoderWorkletMessage,
      [copy.buffer]
    );
    return true;
  }
}

registerProcessor('minutes-mp3-encoder', MinutesMp3Encoder);
