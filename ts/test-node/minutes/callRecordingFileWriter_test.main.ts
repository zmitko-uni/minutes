// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { assert } from 'chai';

import {
  CallRecordingFileWriter,
  recoverInterruptedCallRecordings,
} from '../../../app/minutes_call_recording_channel.main.ts';
import { CallMode } from '../../types/CallDisposition.std.ts';
import {
  SPEAKER_ACTIVITY_LOG_VERSION,
  SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
  RECORDING_PCM_SAMPLE_RATE,
  type SpeakerActivityLog,
} from '../../minutes/speakerActivity.std.ts';
import { RECORDING_PCM_SIDECAR_SUFFIX } from '../../minutes/whisperSettings.std.ts';
import { formatTimestampForRecordingFilename } from '../../minutes/recordingPartialFiles.node.ts';

describe('CallRecordingFileWriter', () => {
  let recordingsDir: string;
  let pcmStorageDir: string;

  beforeEach(async () => {
    recordingsDir = await mkdtemp(join(tmpdir(), 'minutes-call-writer-'));
    pcmStorageDir = join(recordingsDir, 'pcm');
  });

  afterEach(async () => {
    await rm(recordingsDir, { recursive: true, force: true });
  });

  it('serializes concurrent MP3 appends in invocation order', async () => {
    const writer = new CallRecordingFileWriter({
      recordingsDir,
      pcmStorageDir,
    });
    const startedAt = Date.UTC(2026, 6, 22, 10, 0, 0);
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: 'Direct',
      startedAt,
    });

    await Promise.all([
      writer.appendMp3(7, session.sessionId, Uint8Array.from([1, 2])),
      writer.appendMp3(7, session.sessionId, Uint8Array.from([3, 4])),
    ]);
    const result = await writer.finalize(7, session.sessionId, {
      endedAt: startedAt + 60_000,
      recordedDurationMs: 60_000,
      lametagFrame: Uint8Array.from([9, 9]),
      finalFrame: Uint8Array.from([5]),
      speakerActivityLog: null,
    });

    const mp3 = [...(await readFile(result.filePath))];
    assert.deepEqual(mp3, [9, 9, 3, 4, 5]);
  });

  it('rejects an append when the bounded write queue is full', async () => {
    const writer = new CallRecordingFileWriter({
      recordingsDir,
      pcmStorageDir,
      maxQueuedBytes: 3,
    });
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: 'Direct',
      startedAt: Date.UTC(2026, 6, 22, 10, 0, 0),
    });

    const firstWrite = writer.appendMp3(
      7,
      session.sessionId,
      Uint8Array.from([1, 2])
    );

    let error: unknown;
    try {
      await writer.appendMp3(7, session.sessionId, Uint8Array.from([3, 4]));
    } catch (caught) {
      error = caught;
    }
    assert.instanceOf(error, Error);
    assert.include(String(error), 'Call recording write queue is full');
    await firstWrite;
    await writer.abort(7, session.sessionId);
  });

  it('writes PCM sidecar bytes and audio metadata without speaker activity', async () => {
    const writer = new CallRecordingFileWriter({
      recordingsDir,
      pcmStorageDir,
    });
    const startedAt = Date.UTC(2026, 6, 22, 10, 0, 0);
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: CallMode.Group,
      eraId: 'era-id',
      startedAt,
    });
    await writer.appendMp3(7, session.sessionId, Uint8Array.from([1]));
    await writer.appendPcm(
      7,
      session.sessionId,
      Float32Array.from([0.25, -0.5])
    );

    const result = await writer.finalize(7, session.sessionId, {
      endedAt: startedAt + 1_000,
      recordedDurationMs: 1_000,
      lametagFrame: Uint8Array.from([0]),
      finalFrame: Uint8Array.from([]),
      speakerActivityLog: null,
    });

    const pcmData = await readFile(result.pcmPath);
    const pcmSamples = new Float32Array(
      pcmData.buffer.slice(
        pcmData.byteOffset,
        pcmData.byteOffset + pcmData.byteLength
      )
    );
    assert.deepEqual([...pcmSamples], [0.25, -0.5]);

    const metadata = JSON.parse(await readFile(result.metadataPath, 'utf8'));
    assert.deepInclude(metadata, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: 'Group',
      eraId: 'era-id',
      durationMs: 1_000,
      audioFile: result.filePath.split(/[/\\]/).at(-1),
    });
    assert.strictEqual(metadata.speakerActivityFile, undefined);
    await assertFileDoesNotExist(session.partialPath);
  });

  it('writes speaker activity sidecar when the log is valid', async () => {
    const writer = new CallRecordingFileWriter({
      recordingsDir,
      pcmStorageDir,
    });
    const startedAt = Date.UTC(2026, 6, 22, 10, 0, 0);
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: CallMode.Group,
      startedAt,
    });
    const speakerActivityLog: SpeakerActivityLog = {
      version: SPEAKER_ACTIVITY_LOG_VERSION,
      conversationId: 'conversation-id',
      callMode: CallMode.Group,
      recordingStartedAt: startedAt,
      recordingDurationMs: 1_000,
      sampleIntervalMs: SPEAKER_ACTIVITY_SAMPLE_INTERVAL_MS,
      participants: {},
      samples: [],
    };

    const result = await writer.finalize(7, session.sessionId, {
      endedAt: startedAt + 1_000,
      recordedDurationMs: 1_000,
      lametagFrame: Uint8Array.from([0]),
      finalFrame: Uint8Array.from([]),
      speakerActivityLog,
    });

    assert.isString(result.speakerActivityPath);
    const sidecar = JSON.parse(
      await readFile(result.speakerActivityPath as string, 'utf8')
    );
    assert.deepEqual(sidecar, speakerActivityLog);
    const metadata = JSON.parse(await readFile(result.metadataPath, 'utf8'));
    assert.strictEqual(
      metadata.speakerActivityFile,
      (result.speakerActivityPath as string).split(/[/\\]/).at(-1)
    );
  });

  it('rejects appends from a different owner', async () => {
    const writer = new CallRecordingFileWriter({
      recordingsDir,
      pcmStorageDir,
    });
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Team call',
      callMode: 'Direct',
      startedAt: Date.UTC(2026, 6, 22, 10, 0, 0),
    });

    let error: unknown;
    try {
      await writer.appendMp3(8, session.sessionId, Uint8Array.from([1]));
    } catch (caught) {
      error = caught;
    }
    assert.include(String(error), 'Unknown call recording session');
    await writer.abort(7, session.sessionId);
  });
});

describe('recoverInterruptedCallRecordings', () => {
  it('finalizes orphaned partial files and derives duration from PCM size', async () => {
    const root = await mkdtemp(join(tmpdir(), 'minutes-call-recover-'));
    const recordingsDir = join(root, 'recordings');
    const pcmStorageDir = join(root, 'pcm');
    const startedAt = Date.UTC(2026, 6, 22, 10, 0, 0);
    const baseName = [
      formatTimestampForRecordingFilename(startedAt),
      'Team_call',
      'abcdef12',
    ].join('_');
    const mp3Partial = join(recordingsDir, `${baseName}.mp3.partial`);
    const pcmPartial = join(
      pcmStorageDir,
      `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}.partial`
    );
    const pcmBytes = RECORDING_PCM_SAMPLE_RATE * 4;
    await mkdir(recordingsDir, { recursive: true });
    await mkdir(pcmStorageDir, { recursive: true });
    await writeFile(mp3Partial, Uint8Array.from([1, 2, 3]));
    await writeFile(pcmPartial, Buffer.alloc(pcmBytes));

    const recovered = await recoverInterruptedCallRecordings({
      recordingsDir,
      pcmStorageDir,
      activePartialPaths: new Set(),
    });

    assert.strictEqual(recovered.length, 1);
    assert.deepInclude(recovered[0], {
      conversationId: 'abcdef12',
      conversationTitle: 'Team call',
      filePath: join(recordingsDir, `${baseName}.mp3`),
      durationMs: 1_000,
    });
    assert.strictEqual(
      (await stat(join(recordingsDir, `${baseName}.mp3`))).isFile(),
      true
    );
    assert.strictEqual(
      (await stat(join(pcmStorageDir, `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}`)))
        .isFile(),
      true
    );
    const metadata = JSON.parse(
      await readFile(join(recordingsDir, `${baseName}.json`), 'utf8')
    );
    assert.strictEqual(metadata.recoveredFromCrash, true);
    assert.strictEqual(metadata.speakerActivityFile, undefined);

    await rm(root, { recursive: true, force: true });
  });

  it('skips partial files that belong to an active writer session', async () => {
    const recordingsDir = await mkdtemp(join(tmpdir(), 'minutes-call-active-'));
    const pcmStorageDir = join(recordingsDir, 'pcm');
    const writer = new CallRecordingFileWriter({ recordingsDir, pcmStorageDir });
    const session = await writer.create(7, {
      conversationId: 'conversation-id',
      conversationTitle: 'Live',
      callMode: 'Direct',
      startedAt: Date.UTC(2026, 6, 22, 10, 0, 0),
    });

    const recovered = await recoverInterruptedCallRecordings({
      recordingsDir,
      pcmStorageDir,
      activePartialPaths: writer.getActivePartialPaths(),
    });

    assert.deepEqual(recovered, []);
    await writer.abort(7, session.sessionId);
    await rm(recordingsDir, { recursive: true, force: true });
  });
});

async function assertFileDoesNotExist(path: string): Promise<void> {
  let error: unknown;
  try {
    await stat(path);
  } catch (caught) {
    error = caught;
  }
  assert.instanceOf(error, Error);
  assert.include(String(error), 'ENOENT');
}
