// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { join } from 'node:path';

import { utilityProcess } from 'electron';

import { getAppRootDir } from '../util/appRootDir.main.ts';
import {
  onTranscriptionJobCancelled,
  TranscriptionCancelledError,
} from './transcriptionCancel.main.ts';
import type {
  WhisperWorkerMessage,
  WhisperWorkerRequest,
  WhisperWorkerSegment,
} from './whisperWorker.node.ts';

export type WhisperWorkerResult = Readonly<{
  segments: ReadonlyArray<WhisperWorkerSegment>;
  language?: string;
}>;

const WORKER_SCRIPT_PATH = ['bundles', 'workers', 'minutesWhisper.js'] as const;

/**
 * Runs one whisper transcription in a separate utility process. Calling
 * `cancelTranscriptionJob(jobId)` kills that process immediately, so a running
 * transcription stops without waiting for the current decode step to finish.
 */
export function runWhisperTranscribeInProcess(options: {
  jobId: string | undefined;
  request: Omit<WhisperWorkerRequest, 'type' | 'pcmf32'>;
  pcmf32: Float32Array;
  onProgress?: (percent: number) => void;
}): Promise<WhisperWorkerResult> {
  return new Promise<WhisperWorkerResult>((resolve, reject) => {
    const child = utilityProcess.fork(
      join(getAppRootDir(), ...WORKER_SCRIPT_PATH),
      [],
      { serviceName: 'minutes-whisper' }
    );

    let settled = false;
    let unsubscribeCancel: () => void = () => undefined;

    const finish = (settle: () => void): void => {
      if (settled) {
        return;
      }
      settled = true;
      unsubscribeCancel();
      child.kill();
      settle();
    };

    unsubscribeCancel = onTranscriptionJobCancelled(options.jobId, () => {
      finish(() => reject(new TranscriptionCancelledError()));
    });

    child.on('message', (message: WhisperWorkerMessage) => {
      if (message.type === 'progress') {
        options.onProgress?.(message.percent);
        return;
      }
      if (message.type === 'done') {
        finish(() =>
          resolve({ segments: message.segments, language: message.language })
        );
        return;
      }
      finish(() => reject(new Error(message.message)));
    });

    child.once('exit', code => {
      finish(() =>
        reject(
          new Error(`Whisper proces skončil neočekávaně (kód ${String(code)}).`)
        )
      );
    });

    const request: WhisperWorkerRequest = {
      ...options.request,
      type: 'transcribe',
      pcmf32: options.pcmf32,
    };
    // Electron's utilityProcess.postMessage can only transfer MessagePorts, so
    // the PCM is structured-cloned to the worker.
    child.postMessage(request);
  });
}
