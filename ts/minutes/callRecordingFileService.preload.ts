// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { CallRecordingMetadata } from './types.std.ts';
import {
  MINUTES_CALL_RECORDING_IPC,
  type AbortedCallRecordingFile,
  type AppendCallRecordingMp3Input,
  type AppendCallRecordingPcmInput,
  type CreatedCallRecordingFile,
  type CreateCallRecordingFileOptions,
  type FinalizedCallRecordingFile,
  type FinalizeCallRecordingFileInput,
} from './callRecordingFile.std.ts';

export type CallRecordingFileIpcInvoke = (
  channel: string,
  input: unknown
) => Promise<unknown>;

export type CallRecordingFileService = Readonly<{
  create(
    options: CreateCallRecordingFileOptions
  ): Promise<CreatedCallRecordingFile>;
  appendMp3(
    sessionId: string,
    data: AppendCallRecordingMp3Input['data']
  ): Promise<void>;
  appendPcm(
    sessionId: string,
    samples: AppendCallRecordingPcmInput['samples']
  ): Promise<void>;
  finalize(
    input: FinalizeCallRecordingFileInput
  ): Promise<FinalizedCallRecordingFile>;
  abort(sessionId: string): Promise<AbortedCallRecordingFile>;
  recoverInterrupted(): Promise<Array<CallRecordingMetadata>>;
}>;

export function unwrapCallRecordingFileResult<T = void>(result: unknown): T {
  if (
    typeof result === 'object' &&
    result != null &&
    'ok' in result &&
    result.ok === false &&
    'error' in result &&
    typeof result.error === 'string' &&
    'partialPath' in result &&
    typeof result.partialPath === 'string'
  ) {
    throw Object.assign(new Error(result.error), {
      partialPath: result.partialPath,
    });
  }

  if (
    typeof result === 'object' &&
    result != null &&
    'ok' in result &&
    result.ok === true
  ) {
    return ('value' in result ? result.value : undefined) as T;
  }

  throw new Error('Invalid call recording file IPC result');
}

export function createCallRecordingFileService(
  invoke: CallRecordingFileIpcInvoke
): CallRecordingFileService {
  return {
    async create(options) {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.create, options);
      if (
        typeof result !== 'object' ||
        result == null ||
        !('sessionId' in result) ||
        typeof result.sessionId !== 'string' ||
        !('partialPath' in result) ||
        typeof result.partialPath !== 'string'
      ) {
        throw new Error('Invalid create call recording file IPC result');
      }
      return {
        sessionId: result.sessionId,
        partialPath: result.partialPath,
      };
    },
    async appendMp3(sessionId, data) {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.appendMp3, {
        sessionId,
        data,
      } satisfies AppendCallRecordingMp3Input);
      unwrapCallRecordingFileResult(result);
    },
    async appendPcm(sessionId, samples) {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.appendPcm, {
        sessionId,
        samples,
      } satisfies AppendCallRecordingPcmInput);
      unwrapCallRecordingFileResult(result);
    },
    async finalize(input) {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.finalize, input);
      const value = unwrapCallRecordingFileResult<unknown>(result);
      if (
        typeof value !== 'object' ||
        value == null ||
        !('filePath' in value) ||
        typeof value.filePath !== 'string' ||
        !('pcmPath' in value) ||
        typeof value.pcmPath !== 'string' ||
        !('metadataPath' in value) ||
        typeof value.metadataPath !== 'string'
      ) {
        throw new Error('Invalid finalize call recording file IPC result');
      }
      return {
        filePath: value.filePath,
        pcmPath: value.pcmPath,
        metadataPath: value.metadataPath,
        speakerActivityPath:
          'speakerActivityPath' in value &&
          typeof value.speakerActivityPath === 'string'
            ? value.speakerActivityPath
            : undefined,
      };
    },
    async abort(sessionId) {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.abort, {
        sessionId,
      });
      if (
        typeof result !== 'object' ||
        result == null ||
        !('partialPath' in result) ||
        typeof result.partialPath !== 'string'
      ) {
        throw new Error('Invalid abort call recording file IPC result');
      }
      return { partialPath: result.partialPath };
    },
    async recoverInterrupted() {
      const result = await invoke(MINUTES_CALL_RECORDING_IPC.recover, {});
      if (!Array.isArray(result)) {
        return [];
      }
      return result as Array<CallRecordingMetadata>;
    },
  };
}

export const callRecordingFileService = createCallRecordingFileService(
  (channel, input) => ipcRenderer.invoke(channel, input)
);
