// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable signal-desktop/enforce-file-suffix -- Dedicated main-process IPC channel. */

import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  MINUTES_CALL_RECORDING_IPC,
  type CreateCallRecordingFileOptions,
  type FinalizedCallRecordingFile,
  type FinalizeCallRecordingFileInput,
} from '../ts/minutes/callRecordingFile.std.ts';
import { SPEAKER_ACTIVITY_FILE_SUFFIX } from '../ts/minutes/constants.std.ts';
import {
  isSpeakerActivityLog,
  type SpeakerActivityLog,
} from '../ts/minutes/speakerActivity.std.ts';
import type { CallRecordingMetadata } from '../ts/minutes/types.std.ts';
import { RECORDING_PCM_SAMPLE_RATE } from '../ts/minutes/speakerActivity.std.ts';
import { RECORDING_PCM_SIDECAR_SUFFIX } from '../ts/minutes/whisperSettings.std.ts';
import {
  createRecordingPartialFileError,
  formatTimestampForRecordingFilename,
  ignoreFailure,
  isRecordingPartialFileError,
  parseRecordingTimestampFromBaseName,
  parseRecordingTitleFromBaseName,
  reapStaleRecordingPartials,
  sanitizeRecordingFilePart,
} from '../ts/minutes/recordingPartialFiles.node.ts';

type FinalizeOptions = Omit<FinalizeCallRecordingFileInput, 'sessionId'>;

type IpcSenderLike = Readonly<{
  id: number;
  once(event: 'destroyed', listener: () => void): unknown;
}>;

type IpcMainLike = Readonly<{
  handle(
    channel: string,
    listener: (event: { sender: IpcSenderLike }, input: unknown) => unknown
  ): void;
}>;

type RecordingFileHandle = Readonly<{
  writeFile(data: Uint8Array<ArrayBuffer>): Promise<void>;
  writeAt(data: Uint8Array<ArrayBuffer>, position: number): Promise<void>;
  sync(): Promise<void>;
  close(): Promise<void>;
}>;

function createCallRecordingFileError(
  message: string,
  partialPath: string
): Error & Readonly<{ partialPath: string }> {
  return createRecordingPartialFileError(
    message,
    partialPath,
    'CallRecordingFileError'
  );
}

function isCallRecordingFileError(error: unknown): boolean {
  return isRecordingPartialFileError(error);
}

async function openRecordingFile(path: string): Promise<RecordingFileHandle> {
  const handle = await open(path, 'wx');
  return {
    async writeFile(data) {
      await handle.write(data);
    },
    async writeAt(data, position) {
      await handle.write(data, 0, data.byteLength, position);
    },
    async sync() {
      await handle.sync();
    },
    async close() {
      await handle.close();
    },
  };
}

type Session = Readonly<{
  ownerId: number;
  mp3Handle: RecordingFileHandle;
  pcmHandle: RecordingFileHandle;
  partialPath: string;
  pcmPartialPath: string;
  pcmPath: string;
  filePath: string;
  baseName: string;
  options: CreateCallRecordingFileOptions;
}> & {
  queuedBytes: number;
  writes: Promise<void>;
};

function buildBaseName(
  options: CreateCallRecordingFileOptions,
  nameSuffix: string
): string {
  const core = [
    formatTimestampForRecordingFilename(options.startedAt),
    sanitizeRecordingFilePart(options.conversationTitle),
    sanitizeRecordingFilePart(options.conversationId.slice(0, 8)),
  ].join('_');
  return nameSuffix.length > 0 ? `${core}${nameSuffix}` : core;
}

export class CallRecordingFileWriter {
  static readonly DEFAULT_MAX_QUEUED_BYTES = 16 * 1024 * 1024;
  static readonly MAX_REMEMBERED_ABORTS = 32;

  readonly #abortedSessions = new Map<
    string,
    Readonly<{ ownerId: number; partialPath: string }>
  >();
  readonly #maxQueuedBytes: number;
  readonly #openFile: (path: string) => Promise<RecordingFileHandle>;
  readonly #pcmStorageDir: string;
  readonly #recordingsDir: string;
  readonly #renameFile: (source: string, target: string) => Promise<void>;
  readonly #sessions = new Map<string, Session>();

  constructor({
    recordingsDir,
    pcmStorageDir,
    maxQueuedBytes = CallRecordingFileWriter.DEFAULT_MAX_QUEUED_BYTES,
    openFile = openRecordingFile,
    renameFile = rename,
  }: {
    recordingsDir: string;
    pcmStorageDir: string;
    maxQueuedBytes?: number;
    openFile?: (path: string) => Promise<RecordingFileHandle>;
    renameFile?: (source: string, target: string) => Promise<void>;
  }) {
    this.#recordingsDir = recordingsDir;
    this.#pcmStorageDir = pcmStorageDir;
    this.#maxQueuedBytes = maxQueuedBytes;
    this.#openFile = openFile;
    this.#renameFile = renameFile;
  }

  getActivePartialPaths(): ReadonlySet<string> {
    return new Set(
      [...this.#sessions.values()].map(session => session.partialPath)
    );
  }

  async create(
    ownerId: number,
    options: CreateCallRecordingFileOptions
  ): Promise<{ sessionId: string; partialPath: string }> {
    await mkdir(this.#recordingsDir, { recursive: true });
    await mkdir(this.#pcmStorageDir, { recursive: true });

    const sessionId = randomUUID();
    let suffix = '';
    let mp3Handle: RecordingFileHandle | undefined;
    let pcmHandle: RecordingFileHandle | undefined;
    let partialPath = '';
    let pcmPartialPath = '';
    let pcmPath = '';
    let filePath = '';
    let baseName = '';

    for (let attempt = 0; attempt < 100; attempt += 1) {
      baseName = buildBaseName(options, suffix);
      filePath = join(this.#recordingsDir, `${baseName}.mp3`);
      partialPath = `${filePath}.partial`;
      pcmPath = join(this.#pcmStorageDir, `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}`);
      pcmPartialPath = `${pcmPath}.partial`;
      try {
        // eslint-disable-next-line no-await-in-loop
        mp3Handle = await this.#openFile(partialPath);
        try {
          // eslint-disable-next-line no-await-in-loop
          pcmHandle = await this.#openFile(pcmPartialPath);
        } catch (error) {
          await ignoreFailure(() => mp3Handle?.close());
          await ignoreFailure(() => rm(partialPath, { force: true }));
          throw error;
        }
        break;
      } catch (error) {
        if (
          error != null &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'EEXIST'
        ) {
          suffix = suffix.length === 0 ? '-2' : `-${attempt + 2}`;
          continue;
        }
        throw error;
      }
    }

    if (mp3Handle == null || pcmHandle == null) {
      throw new Error('Could not allocate call recording file names');
    }

    this.#sessions.set(sessionId, {
      ownerId,
      mp3Handle,
      pcmHandle,
      partialPath,
      pcmPartialPath,
      pcmPath,
      filePath,
      baseName,
      options,
      queuedBytes: 0,
      writes: Promise.resolve(),
    });
    return { sessionId, partialPath };
  }

  async appendMp3(
    ownerId: number,
    sessionId: string,
    data: Uint8Array<ArrayBuffer>
  ): Promise<void> {
    const session = this.#getOwnedSession(ownerId, sessionId);
    await this.#appendBytes(session, session.mp3Handle, data);
  }

  async appendPcm(
    ownerId: number,
    sessionId: string,
    samples: Float32Array<ArrayBuffer>
  ): Promise<void> {
    const session = this.#getOwnedSession(ownerId, sessionId);
    const chunk = Buffer.from(
      samples.buffer,
      samples.byteOffset,
      samples.byteLength
    );
    await this.#appendBytes(session, session.pcmHandle, chunk);
  }

  async #appendBytes(
    session: Session,
    handle: RecordingFileHandle,
    data: Uint8Array<ArrayBuffer>
  ): Promise<void> {
    if (session.queuedBytes + data.byteLength > this.#maxQueuedBytes) {
      throw createCallRecordingFileError(
        'Call recording write queue is full',
        session.partialPath
      );
    }
    session.queuedBytes += data.byteLength;
    session.writes = this.#writeAfterPending(session, handle, data);
    await session.writes;
  }

  async #writeAfterPending(
    session: Session,
    handle: RecordingFileHandle,
    chunk: Uint8Array<ArrayBuffer>
  ): Promise<void> {
    const previousWrites = session.writes;
    try {
      await previousWrites;
      await handle.writeFile(chunk);
    } catch (error) {
      if (isCallRecordingFileError(error)) {
        throw error;
      }
      throw createCallRecordingFileError(
        `Call recording write failed: ${String(error)}`,
        session.partialPath
      );
    } finally {
      // Decrement on the session object even after abort() removed it from
      // #sessions, so in-flight appends racing abort still see a consistent
      // queuedBytes. New sessions always start at 0.
      session.queuedBytes -= chunk.byteLength;
    }
  }

  async finalize(
    ownerId: number,
    sessionId: string,
    options: FinalizeOptions
  ): Promise<FinalizedCallRecordingFile> {
    const session = this.#getOwnedSession(ownerId, sessionId);
    const metadataPath = session.filePath.replace(/\.mp3$/, '.json');
    const metadataPartialPath = `${metadataPath}.partial`;
    const speakerActivityPath = session.filePath.replace(
      /\.mp3$/,
      SPEAKER_ACTIVITY_FILE_SUFFIX
    );
    const speakerActivityPartialPath = `${speakerActivityPath}.partial`;
    const hasSpeakerLog =
      options.speakerActivityLog != null &&
      isSpeakerActivityLog(options.speakerActivityLog);

    let mp3Renamed = false;
    let pcmRenamed = false;
    let metadataRenamed = false;
    let speakerRenamed = false;

    try {
      await session.writes;
      if (options.finalFrame.byteLength > 0) {
        await session.mp3Handle.writeFile(options.finalFrame);
      }
      await session.mp3Handle.writeAt(options.lametagFrame, 0);
      await session.mp3Handle.sync();
      await session.pcmHandle.sync();

      const metadataBody: Record<string, unknown> = {
        conversationId: session.options.conversationId,
        conversationTitle: session.options.conversationTitle,
        callMode: session.options.callMode,
        eraId: session.options.eraId,
        startedAt: session.options.startedAt,
        endedAt: options.endedAt,
        durationMs: options.recordedDurationMs,
        audioFile: basename(session.filePath),
      };
      if (hasSpeakerLog) {
        metadataBody.speakerActivityFile = basename(speakerActivityPath);
      }

      await writeFile(
        metadataPartialPath,
        JSON.stringify(metadataBody, null, 2),
        { encoding: 'utf8', flag: 'wx' }
      );

      if (hasSpeakerLog) {
        await writeFile(
          speakerActivityPartialPath,
          JSON.stringify(options.speakerActivityLog, null, 2),
          { encoding: 'utf8', flag: 'wx' }
        );
      }

      await session.mp3Handle.close();
      await session.pcmHandle.close();
      await this.#renameFile(session.pcmPartialPath, session.pcmPath);
      pcmRenamed = true;
      if (hasSpeakerLog) {
        await this.#renameFile(
          speakerActivityPartialPath,
          speakerActivityPath
        );
        speakerRenamed = true;
      }
      await this.#renameFile(metadataPartialPath, metadataPath);
      metadataRenamed = true;
      await this.#renameFile(session.partialPath, session.filePath);
      mp3Renamed = true;
    } catch (error) {
      await ignoreFailure(() => session.mp3Handle.close());
      await ignoreFailure(() => session.pcmHandle.close());
      if (mp3Renamed) {
        await ignoreFailure(() =>
          this.#renameFile(session.filePath, session.partialPath)
        );
      }
      if (pcmRenamed) {
        await ignoreFailure(() =>
          this.#renameFile(session.pcmPath, session.pcmPartialPath)
        );
      }
      if (metadataRenamed) {
        await ignoreFailure(() => rm(metadataPath, { force: true }));
      }
      if (speakerRenamed) {
        await ignoreFailure(() => rm(speakerActivityPath, { force: true }));
      }
      await ignoreFailure(() => rm(metadataPartialPath, { force: true }));
      await ignoreFailure(() => rm(speakerActivityPartialPath, { force: true }));
      if (isCallRecordingFileError(error)) {
        throw error;
      }
      throw createCallRecordingFileError(
        `Call recording finalization failed: ${String(error)}`,
        session.partialPath
      );
    }

    this.#sessions.delete(sessionId);
    return {
      filePath: session.filePath,
      pcmPath: session.pcmPath,
      metadataPath,
      speakerActivityPath: hasSpeakerLog ? speakerActivityPath : undefined,
    };
  }

  async abort(
    ownerId: number,
    sessionId: string
  ): Promise<{ partialPath: string }> {
    const session = this.#sessions.get(sessionId);
    if (!session) {
      const aborted = this.#abortedSessions.get(sessionId);
      if (aborted?.ownerId === ownerId) {
        return { partialPath: aborted.partialPath };
      }
      throw new Error('Unknown call recording session');
    }
    if (session.ownerId !== ownerId) {
      throw new Error('Unknown call recording session');
    }

    this.#sessions.delete(sessionId);
    this.#rememberAbortedSession(sessionId, ownerId, session.partialPath);

    try {
      await session.writes;
    } catch {
      // Preserve partial files for recovery.
    }
    await Promise.allSettled([
      session.mp3Handle.close(),
      session.pcmHandle.close(),
    ]);
    return { partialPath: session.partialPath };
  }

  async cleanupOwner(ownerId: number): Promise<void> {
    const sessionIds = [...this.#sessions.entries()]
      .filter(([, session]) => session.ownerId === ownerId)
      .map(([sessionId]) => sessionId);
    await Promise.all(
      sessionIds.map(async sessionId => {
        await this.abort(ownerId, sessionId);
      })
    );
  }

  #rememberAbortedSession(
    sessionId: string,
    ownerId: number,
    partialPath: string
  ): void {
    if (
      this.#abortedSessions.size >= CallRecordingFileWriter.MAX_REMEMBERED_ABORTS
    ) {
      const oldestSessionId = this.#abortedSessions.keys().next().value;
      if (oldestSessionId) {
        this.#abortedSessions.delete(oldestSessionId);
      }
    }
    this.#abortedSessions.set(sessionId, { ownerId, partialPath });
  }

  #getOwnedSession(ownerId: number, sessionId: string): Session {
    const session = this.#sessions.get(sessionId);
    if (!session || session.ownerId !== ownerId) {
      throw new Error('Unknown call recording session');
    }
    return session;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function recoverInterruptedCallRecordings({
  recordingsDir,
  pcmStorageDir,
  activePartialPaths,
}: {
  recordingsDir: string;
  pcmStorageDir: string;
  activePartialPaths: ReadonlySet<string>;
}): Promise<Array<CallRecordingMetadata>> {
  let fileNames: ReadonlyArray<string>;
  try {
    fileNames = await readdir(recordingsDir);
  } catch (error) {
    if (
      error != null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return [];
    }
    throw error;
  }

  const recovered = new Array<CallRecordingMetadata>();

  for (const fileName of fileNames) {
    if (!fileName.endsWith('.mp3.partial')) {
      continue;
    }
    const partialPath = join(recordingsDir, fileName);
    if (activePartialPaths.has(partialPath)) {
      continue;
    }

    const baseName = fileName.replace(/\.mp3\.partial$/, '');
    const filePath = join(recordingsDir, `${baseName}.mp3`);
    const metadataPath = join(recordingsDir, `${baseName}.json`);
    if (await pathExists(filePath) || await pathExists(metadataPath)) {
      continue;
    }

    const pcmPartialPath = join(
      pcmStorageDir,
      `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}.partial`
    );
    if (!(await pathExists(pcmPartialPath))) {
      continue;
    }

    const pcmPath = join(
      pcmStorageDir,
      `${baseName}${RECORDING_PCM_SIDECAR_SUFFIX}`
    );
    const pcmStats = await stat(pcmPartialPath);
    const durationMs = Math.round(
      (pcmStats.size / 4 / RECORDING_PCM_SAMPLE_RATE) * 1000
    );
    const startedAt =
      parseRecordingTimestampFromBaseName(baseName) ?? pcmStats.mtimeMs;
    const endedAt = startedAt + durationMs;
    const conversationTitle = parseRecordingTitleFromBaseName(baseName);
    const idSuffix = baseName.split('_').at(-1) ?? 'unknown';
    const conversationId = idSuffix;

    const metadataBody = {
      conversationId,
      conversationTitle,
      startedAt,
      endedAt,
      durationMs,
      audioFile: `${baseName}.mp3`,
      recoveredFromCrash: true,
    };

    const metadataPartialPath = `${metadataPath}.partial`;
    try {
      await writeFile(
        metadataPartialPath,
        JSON.stringify(metadataBody, null, 2),
        { encoding: 'utf8', flag: 'wx' }
      );
      await rename(pcmPartialPath, pcmPath);
      await rename(metadataPartialPath, metadataPath);
      await rename(partialPath, filePath);
      recovered.push({
        conversationId,
        conversationTitle,
        startedAt,
        endedAt,
        filePath,
        durationMs,
      });
    } catch {
      await ignoreFailure(() => rm(metadataPartialPath, { force: true }));
    }
  }

  return recovered;
}

export function initializeMinutesCallRecordingChannel({
  ipcMain,
  recordingsDir,
  pcmStorageDir,
  writer = new CallRecordingFileWriter({ recordingsDir, pcmStorageDir }),
  onFinalized,
}: {
  ipcMain: IpcMainLike;
  recordingsDir: string;
  pcmStorageDir: string;
  writer?: CallRecordingFileWriter;
  onFinalized?: (value: FinalizedCallRecordingFile) => void | Promise<void>;
}): CallRecordingFileWriter {
  for (const directory of new Set([recordingsDir, pcmStorageDir])) {
    void reapStaleRecordingPartials(directory).catch(() => undefined);
  }
  const registeredSenders = new WeakSet<IpcSenderLike>();

  function registerCleanup(sender: IpcSenderLike): void {
    if (registeredSenders.has(sender)) {
      return;
    }
    registeredSenders.add(sender);
    sender.once('destroyed', () => {
      void ignoreFailure(() => writer.cleanupOwner(sender.id));
    });
  }

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.create, (event, input) => {
    registerCleanup(event.sender);
    return writer.create(
      event.sender.id,
      input as CreateCallRecordingFileOptions
    );
  });

  async function appendFailure(
    senderId: number,
    sessionId: string,
    error: unknown
  ): Promise<{
    ok: false;
    error: string;
    partialPath: string;
  }> {
    const partialPath = isCallRecordingFileError(error)
      ? (error as { partialPath: string }).partialPath
      : '';
    await ignoreFailure(() => writer.abort(senderId, sessionId));
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      partialPath,
    };
  }

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.appendMp3, async (event, input) => {
    const { sessionId, data } = input as {
      sessionId: string;
      data: Uint8Array<ArrayBuffer>;
    };
    try {
      await writer.appendMp3(event.sender.id, sessionId, data);
      return { ok: true } as const;
    } catch (error) {
      return appendFailure(event.sender.id, sessionId, error);
    }
  });

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.appendPcm, async (event, input) => {
    const { sessionId, samples } = input as {
      sessionId: string;
      samples: Float32Array<ArrayBuffer>;
    };
    try {
      await writer.appendPcm(event.sender.id, sessionId, samples);
      return { ok: true, value: undefined };
    } catch (error) {
      return appendFailure(event.sender.id, sessionId, error);
    }
  });

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.finalize, async (event, input) => {
    const { sessionId, ...options } = input as FinalizeOptions & {
      sessionId: string;
    };
    try {
      const value = await writer.finalize(event.sender.id, sessionId, options);
      // Files and handles are already released; do not abort a published session.
      await ignoreFailure(async () => {
        await onFinalized?.(value);
      });
      return { ok: true, value } as const;
    } catch (error) {
      return appendFailure(event.sender.id, sessionId, error);
    }
  });

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.abort, (event, input) => {
    const { sessionId } = input as { sessionId: string };
    return writer.abort(event.sender.id, sessionId);
  });

  ipcMain.handle(MINUTES_CALL_RECORDING_IPC.recover, async () => {
    return recoverInterruptedCallRecordings({
      recordingsDir,
      pcmStorageDir,
      activePartialPaths: writer.getActivePartialPaths(),
    });
  });

  return writer;
}
