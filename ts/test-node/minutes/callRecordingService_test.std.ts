// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { CallMode } from '../../types/CallDisposition.std.ts';
import {
  MinutesCaptureCoordinator,
  minutesCaptureCoordinator,
} from '../../minutes/captureCoordinator.std.ts';
import {
  CallRecordingServiceCore,
  type CallRecordingServiceDependencies,
} from '../../minutes/callRecordingServiceCore.std.ts';

type RecorderStopResult = Readonly<{
  recordedDurationMs: number;
  lametagFrame: Uint8Array<ArrayBuffer>;
  finalFrame: Uint8Array<ArrayBuffer>;
}>;

function createStream(): MediaStream {
  return {
    getTracks: () => [],
  } as unknown as MediaStream;
}

function createDefaultStopResult(): RecorderStopResult {
  return {
    recordedDurationMs: 1_000,
    lametagFrame: Uint8Array.from([9, 9]),
    finalFrame: Uint8Array.from([7, 8]),
  };
}

function createHarness(options?: {
  coordinator?: MinutesCaptureCoordinator;
  createRingRtcAudioTrack?: (onFatalError: (error: Error) => void) => Promise<{
    stream: MediaStream;
    pause(): void;
    resume(): void;
    stop(): Promise<void>;
  }>;
  recorderStart?: () => Promise<boolean>;
  recorderStop?: () => Promise<RecorderStopResult | undefined>;
  writerCreate?: () => Promise<{ sessionId: string; partialPath: string }>;
  writerFinalize?: () => Promise<{
    filePath: string;
    pcmPath: string;
    metadataPath: string;
  }>;
  appendMp3?: () => Promise<void>;
}) {
  const coordinator = options?.coordinator ?? new MinutesCaptureCoordinator();
  const calls = {
    enqueue: 0,
    pause: 0,
    recorderStart: 0,
    recorderStop: 0,
    ringRtcCreate: 0,
    ringRtcPause: 0,
    ringRtcResume: 0,
    ringRtcStop: 0,
    resume: 0,
    writerAbort: 0,
    writerCreate: 0,
    writerFinalize: 0,
    showError: 0,
  };
  let recorderActive = false;
  let writerSessionId = 'writer-session';

  const dependencies: CallRecordingServiceDependencies = {
    coordinator,
    isRecordableCallMode: () => true,
    warmup: async () => undefined,
    recorder: {
      isActive: () => recorderActive,
      getSessionId: () => (recorderActive ? writerSessionId : undefined),
      start: async (_streams, startOptions) => {
        calls.recorderStart += 1;
        const started = await (options?.recorderStart?.() ?? true);
        recorderActive = started;
        if (started) {
          writerSessionId = startOptions.sessionId;
        }
        return started;
      },
      pause: () => {
        calls.pause += 1;
        return recorderActive;
      },
      resume: () => {
        calls.resume += 1;
        return recorderActive;
      },
      stop: async () => {
        calls.recorderStop += 1;
        recorderActive = false;
        return options?.recorderStop?.() ?? createDefaultStopResult();
      },
    },
    getConversationTitle: () => 'Alice',
    createAudioTrack: async onFatalError => {
      calls.ringRtcCreate += 1;
      if (options?.createRingRtcAudioTrack) {
        return options.createRingRtcAudioTrack(onFatalError);
      }
      return {
        stream: createStream(),
        pause: () => {
          calls.ringRtcPause += 1;
        },
        resume: () => {
          calls.ringRtcResume += 1;
        },
        stop: async () => {
          calls.ringRtcStop += 1;
        },
      };
    },
    speakerActivity: {
      onRecordingPcm: () => undefined,
      start: () => undefined,
      pause: () => undefined,
      resume: () => undefined,
      stop: () => null,
    },
    normalizeSpeakerActivityLog: (_log, durationMs) =>
      durationMs > 0 ? null : null,
    writer: {
      create: async () => {
        calls.writerCreate += 1;
        const created =
          options?.writerCreate?.() ??
          Promise.resolve({
            sessionId: writerSessionId,
            partialPath: '/recordings/call.mp3.partial',
          });
        return created;
      },
      appendMp3: async () => {
        await options?.appendMp3?.();
      },
      appendPcm: async () => undefined,
      finalize: async () => {
        calls.writerFinalize += 1;
        return (
          options?.writerFinalize?.() ??
          Promise.resolve({
            filePath: '/recordings/call.mp3',
            pcmPath: '/pcm/call.pcm.f32',
            metadataPath: '/recordings/call.json',
          })
        );
      },
      abort: async () => {
        calls.writerAbort += 1;
      },
    },
    showError: () => {
      calls.showError += 1;
    },
    showFileSaved: () => undefined,
    enqueueRecordingTranscription: () => {
      calls.enqueue += 1;
    },
    emitState: () => undefined,
    log: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
    now: () => Date.UTC(2026, 6, 22, 10, 1, 0),
  };

  const service = new CallRecordingServiceCore(dependencies);
  return { calls, coordinator, service };
}

const recordingOptions = {
  conversationId: 'conversation-id',
  callMode: 'Group' as CallMode,
  eraId: 'era-id',
  remoteDisplayName: 'Bob',
};

describe('CallRecordingServiceCore', () => {
  it('does not share the global capture coordinator between tests', () => {
    assert.strictEqual(minutesCaptureCoordinator.state, 'idle');
  });

  it('releases audio when the recorder rejects the streams', async () => {
    const { coordinator, service } = createHarness({
      recorderStart: async () => false,
    });

    assert.strictEqual(await service.startRecording(recordingOptions), false);
    assert.strictEqual(coordinator.state, 'idle');
  });

  it('releases audio when startup throws', async () => {
    const { coordinator, service } = createHarness({
      createRingRtcAudioTrack: async () => {
        throw new Error('capture failed');
      },
    });

    assert.strictEqual(await service.startRecording(recordingOptions), false);
    assert.strictEqual(coordinator.state, 'idle');
  });

  it('does not open capture sources when another capture mode owns the coordinator', async () => {
    const coordinator = new MinutesCaptureCoordinator();
    const videoLease = coordinator.acquire('video', async () => undefined);
    let sourceCalls = 0;
    const { service } = createHarness({
      coordinator,
      createRingRtcAudioTrack: async () => {
        sourceCalls += 1;
        return {
          stream: createStream(),
          pause: () => undefined,
          resume: () => undefined,
          stop: async () => undefined,
        };
      },
    });

    assert.strictEqual(await service.startRecording(recordingOptions), false);
    assert.strictEqual(sourceCalls, 0);
    videoLease.release();
  });

  it('keeps recorder and coordinator pause states aligned', async () => {
    const { calls, coordinator, service } = createHarness();
    assert.strictEqual(await service.startRecording(recordingOptions), true);

    assert.strictEqual(service.pauseRecording(), true);
    assert.strictEqual(calls.pause, 1);
    assert.strictEqual(calls.ringRtcPause, 1);
    assert.strictEqual(coordinator.state, 'audio-paused');

    assert.strictEqual(service.resumeRecording(), true);
    assert.strictEqual(calls.resume, 1);
    assert.strictEqual(calls.ringRtcResume, 1);
    assert.strictEqual(coordinator.state, 'audio-recording');
  });

  it('stops and reports a RingRTC audio failure during recording', async () => {
    let reportFatalError: ((error: Error) => void) | undefined;
    const { calls, coordinator, service } = createHarness({
      createRingRtcAudioTrack: async onFatalError => {
        reportFatalError = onFatalError;
        return {
          stream: createStream(),
          pause: () => undefined,
          resume: () => undefined,
          stop: async () => {
            calls.ringRtcStop += 1;
          },
        };
      },
    });
    assert.strictEqual(await service.startRecording(recordingOptions), true);

    reportFatalError?.(new Error('tap overflow'));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.strictEqual(calls.showError, 1);
    assert.strictEqual(calls.recorderStop, 1);
    assert.strictEqual(calls.ringRtcStop, 1);
    assert.strictEqual(coordinator.state, 'idle');
  });

  it('keeps finalizing through durable finalize and deduplicates concurrent stops', async () => {
    const { promise, resolve } = Promise.withResolvers<unknown>();
    const { promise: finalizeStarted, resolve: markFinalizeStarted } =
      Promise.withResolvers<void>();
    const { calls, coordinator, service } = createHarness({
      writerFinalize: () => {
        markFinalizeStarted();
        return promise as Promise<{
          filePath: string;
          pcmPath: string;
          metadataPath: string;
        }>;
      },
    });
    assert.strictEqual(await service.startRecording(recordingOptions), true);

    const firstStop = service.stopRecording();
    const secondStop = service.stopRecording();

    assert.strictEqual(coordinator.state, 'finalizing');
    assert.strictEqual(calls.recorderStop, 1);
    await finalizeStarted;
    assert.strictEqual(calls.ringRtcStop, 1);
    assert.strictEqual(calls.writerFinalize, 1);

    resolve({
      filePath: '/recordings/call.mp3',
      pcmPath: '/pcm/call.pcm.f32',
      metadataPath: '/recordings/call.json',
    });
    const [first, second] = await Promise.all([firstStop, secondStop]);

    assert.deepEqual(second, first);
    assert.deepInclude(first, {
      conversationId: 'conversation-id',
      conversationTitle: 'Alice',
      filePath: '/recordings/call.mp3',
    });
    assert.strictEqual(calls.recorderStop, 1);
    assert.strictEqual(calls.writerFinalize, 1);
    assert.strictEqual(calls.enqueue, 1);
    assert.strictEqual(coordinator.state, 'idle');
    assert.deepEqual(service.getState(), { status: 'idle' });
  });

  it('aborts the writer session when finalize fails and keeps the partial', async () => {
    const { calls, coordinator, service } = createHarness({
      writerFinalize: async () => {
        throw new Error('disk full');
      },
    });
    assert.strictEqual(await service.startRecording(recordingOptions), true);

    const result = await service.stopRecording();

    assert.strictEqual(result, null);
    assert.strictEqual(calls.writerFinalize, 1);
    assert.strictEqual(calls.writerAbort, 1);
    assert.strictEqual(calls.enqueue, 0);
    assert.strictEqual(coordinator.state, 'idle');
  });
});
