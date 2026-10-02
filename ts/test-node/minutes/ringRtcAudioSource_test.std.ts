// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { strict as assert } from 'node:assert';

type WorkletMessage = Readonly<{
  data: unknown;
}>;

class FakeMessagePort {
  onmessage: ((event: WorkletMessage) => void) | null = null;
  readonly events = new Array<unknown>();

  postMessage(data: unknown): void {
    this.events.push(data);
  }
}

type AudioSourceProcessor = Readonly<{
  port: FakeMessagePort;
  process: (
    inputs: Array<Array<Float32Array<ArrayBuffer>>>,
    outputs: Array<Array<Float32Array<ArrayBuffer>>>
  ) => boolean;
}>;

function isSkippedEvent(
  event: unknown
): event is Readonly<{ type: 'timeline-skipped'; skippedSamples: number }> {
  return (
    typeof event === 'object' &&
    event != null &&
    'type' in event &&
    event.type === 'timeline-skipped'
  );
}

let processorClass: (new () => AudioSourceProcessor) | undefined;

// The worklet registers itself once on import, so load it once and restore the
// globals right away; the class keeps extending the fake base class.
async function loadProcessorClass(): Promise<new () => AudioSourceProcessor> {
  if (processorClass) {
    return processorClass;
  }
  const globals = globalThis as typeof globalThis & {
    AudioWorkletProcessor?: unknown;
    registerProcessor?: (
      name: string,
      processor: new () => AudioSourceProcessor
    ) => void;
  };
  const previousProcessor = globals.AudioWorkletProcessor;
  const previousRegister = globals.registerProcessor;

  class FakeAudioWorkletProcessor {
    readonly port = new FakeMessagePort();
  }

  globals.AudioWorkletProcessor = FakeAudioWorkletProcessor;
  globals.registerProcessor = (name, processor) => {
    assert.equal(name, 'minutes-ringrtc-audio-source');
    processorClass = processor;
  };
  try {
    await import('../../minutes/ringRtcAudioSource.std.ts');
  } finally {
    if (previousProcessor === undefined) {
      delete globals.AudioWorkletProcessor;
    } else {
      globals.AudioWorkletProcessor = previousProcessor;
    }
    if (previousRegister === undefined) {
      delete globals.registerProcessor;
    } else {
      globals.registerProcessor = previousRegister;
    }
  }
  assert.ok(processorClass);
  return processorClass;
}

describe('Minutes RingRTC audio worklet', () => {
  it('supports one-sided startup and reports rendered PCM exactly', async () => {
    const ProcessorClass = await loadProcessorClass();

    const degradedProcessor = new ProcessorClass();
    assert.ok(degradedProcessor.port.onmessage);
    degradedProcessor.port.onmessage({
      data: {
        type: 'packet',
        source: 'remote',
        startSample: 0,
        samples: new Float32Array(4_800).fill(0.5),
      },
    });
    assert.deepEqual(degradedProcessor.port.events, []);
    degradedProcessor.port.onmessage({ data: { type: 'start-degraded' } });
    assert.deepEqual(degradedProcessor.port.events, [{ type: 'ready' }]);
    const degradedOutput = new Float32Array(128);
    degradedProcessor.process([], [[degradedOutput]]);
    assert.deepEqual([...degradedOutput], Array(128).fill(0.5));

    const processor = new ProcessorClass();
    assert.ok(processor.port.onmessage);

    processor.port.onmessage({
      data: {
        type: 'packet',
        source: 'local',
        startSample: 0,
        samples: new Float32Array(30_400).fill(0.25),
      },
    });
    processor.port.onmessage({
      data: {
        type: 'packet',
        source: 'remote',
        startSample: 0,
        samples: new Float32Array(4_800).fill(0.5),
      },
    });

    processor.process([], [[new Float32Array(128)]]);
    processor.port.onmessage({
      data: { type: 'start-generation', generation: 1 },
    });

    const renderCount = 200;
    const samplesPerRender = 128;
    for (let index = 0; index < renderCount; index += 1) {
      processor.process([], [[new Float32Array(samplesPerRender)]]);
    }
    processor.port.onmessage({ data: { type: 'stop' } });

    const reportedPcmSamples = processor.port.events.reduce<number>(
      (total, event) => {
        if (
          typeof event === 'object' &&
          event != null &&
          'type' in event &&
          event.type === 'rendered-pcm' &&
          'generation' in event &&
          event.generation === 1 &&
          'samples' in event &&
          event.samples instanceof Float32Array
        ) {
          return total + event.samples.length;
        }
        return total;
      },
      0
    );
    assert.equal(reportedPcmSamples, renderCount * samplesPerRender);
    assert.deepEqual(processor.port.events.filter(isSkippedEvent), []);
  });

  it('keeps recording live audio after a render stall and reports the skipped part', async () => {
    const ProcessorClass = await loadProcessorClass();
    const processor = new ProcessorClass();
    const { onmessage } = processor.port;
    assert.ok(onmessage);
    const deliver = (startSample: number, sampleCount: number) => {
      onmessage({
        data: {
          type: 'packet',
          source: 'local',
          startSample,
          samples: new Float32Array(sampleCount).fill(0.25),
        },
      });
      onmessage({
        data: {
          type: 'packet',
          source: 'remote',
          startSample,
          samples: new Float32Array(sampleCount).fill(0.5),
        },
      });
    };

    deliver(0, 4_800);
    processor.process([], [[new Float32Array(128)]]);

    // The render thread stalls for 1.5 s while RingRTC keeps capturing.
    deliver(4_800, 72_000);

    const afterStall = new Float32Array(128);
    processor.process([], [[afterStall]]);
    assert.deepEqual([...afterStall], Array(128).fill(0.75));
    assert.deepEqual(processor.port.events.filter(isSkippedEvent), [
      { type: 'timeline-skipped', skippedSamples: 76_800 - 4_800 - 128 },
    ]);

    deliver(76_800, 480);
    const live = new Float32Array(128);
    processor.process([], [[live]]);
    assert.deepEqual([...live], Array(128).fill(0.75));
    assert.equal(processor.port.events.filter(isSkippedEvent).length, 1);
  });
});
