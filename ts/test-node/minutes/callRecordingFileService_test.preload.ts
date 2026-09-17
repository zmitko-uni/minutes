// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { CallMode } from '../../types/CallDisposition.std.ts';
import {
  SPEAKER_ACTIVITY_LOG_VERSION,
  SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
  type SpeakerActivityLog,
} from '../../minutes/speakerActivity.std.ts';
import {
  createCallRecordingFileService,
  unwrapCallRecordingFileResult,
} from '../../minutes/callRecordingFileService.preload.ts';

const speakerActivityLog: SpeakerActivityLog = {
  version: SPEAKER_ACTIVITY_LOG_VERSION,
  conversationId: 'conversation-id',
  callMode: CallMode.Direct,
  recordingStartedAt: Date.UTC(2026, 6, 22, 10, 0, 0),
  recordingDurationMs: 55_000,
  sampleIntervalMs: SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
  participants: {},
  samples: [],
};

describe('unwrapCallRecordingFileResult', () => {
  it('throws an Error carrying the retained partial path on failure', () => {
    let error: unknown;
    try {
      unwrapCallRecordingFileResult({
        ok: false,
        error: 'disk full',
        partialPath: '/recordings/call.mp3.partial',
      });
    } catch (caught) {
      error = caught;
    }

    assert.instanceOf(error, Error);
    assert.strictEqual(error.message, 'disk full');
    assert.strictEqual(
      (error as Error & { partialPath?: string }).partialPath,
      '/recordings/call.mp3.partial'
    );
  });
});

describe('callRecordingFileService', () => {
  it('creates a streaming file session through the typed IPC channel', async () => {
    const calls: Array<{ channel: string; input: unknown }> = [];
    const service = createCallRecordingFileService(async (channel, input) => {
      calls.push({ channel, input });
      return {
        sessionId: 'session-id',
        partialPath: '/recordings/call.mp3.partial',
      };
    });
    const options = {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: 'Direct',
      startedAt: Date.UTC(2026, 6, 22, 10, 0, 0),
    };

    const created = await service.create(options);

    assert.deepEqual(created, {
      sessionId: 'session-id',
      partialPath: '/recordings/call.mp3.partial',
    });
    assert.deepEqual(calls, [
      { channel: 'minutes:create-call-recording-file', input: options },
    ]);
  });

  it('streams MP3 and PCM through dedicated IPC channels', async () => {
    const calls: Array<{ channel: string; input: unknown }> = [];
    const service = createCallRecordingFileService(async (channel, input) => {
      calls.push({ channel, input });
      return { ok: true };
    });
    const mp3 = Uint8Array.from([1, 2, 3]);
    const pcm = Float32Array.from([0.1, 0.2]);

    await service.appendMp3('session-id', mp3);
    await service.appendPcm('session-id', pcm);

    assert.deepEqual(calls, [
      {
        channel: 'minutes:append-call-recording-mp3',
        input: { sessionId: 'session-id', data: mp3 },
      },
      {
        channel: 'minutes:append-call-recording-pcm',
        input: { sessionId: 'session-id', samples: pcm },
      },
    ]);
  });

  it('finalizes through the typed IPC channel', async () => {
    const service = createCallRecordingFileService(async () => ({
      ok: true,
      value: {
        filePath: '/recordings/call.mp3',
        pcmPath: '/pcm/call.pcm.f32',
        metadataPath: '/recordings/call.json',
        speakerActivityPath: '/recordings/call.speaker-activity.json',
      },
    }));

    const result = await service.finalize({
      sessionId: 'session-id',
      endedAt: Date.UTC(2026, 6, 22, 10, 1, 0),
      recordedDurationMs: 55_000,
      lametagFrame: Uint8Array.from([9]),
      finalFrame: Uint8Array.from([7]),
      speakerActivityLog,
    });

    assert.deepEqual(result, {
      filePath: '/recordings/call.mp3',
      pcmPath: '/pcm/call.pcm.f32',
      metadataPath: '/recordings/call.json',
      speakerActivityPath: '/recordings/call.speaker-activity.json',
    });
  });

  it('recovers interrupted recordings through the recover IPC channel', async () => {
    const calls: Array<string> = [];
    const service = createCallRecordingFileService(async channel => {
      calls.push(channel);
      return [
        {
          conversationId: 'conversation-id',
          conversationTitle: 'Team call',
          startedAt: 1,
          endedAt: 2,
          filePath: '/recordings/call.mp3',
          durationMs: 1_000,
        },
      ];
    });

    const recovered = await service.recoverInterrupted();

    assert.deepEqual(calls, ['minutes:recover-call-recordings']);
    assert.strictEqual(recovered.length, 1);
  });
});
