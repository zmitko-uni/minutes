// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  onTranscriptionJobCancelled,
  TranscriptionCancelledError,
} from './transcriptionCancel.main.ts';
import {
  DEFAULT_CLI_EXECUTABLE,
  describeCliMissing,
} from './whisperBackend.std.ts';
import type { WhisperBackendStatus } from './whisperBackend.std.ts';
import {
  buildWhisperCliArgs,
  encodePcmF32ToWav16k,
  parseWhisperCliJson,
  parseWhisperCliProgress,
} from './whisperCli.std.ts';
import type { WhisperWorkerRequest } from './whisperWorker.node.ts';
import type { WhisperWorkerResult } from './whisperWorkerProcess.main.ts';

type CliRuntimeStatus = WhisperBackendStatus & { executable: string };

const RUNTIME_CHECK_TIMEOUT_MS = 5000;
const STDERR_TAIL_BYTES = 4096;

const runtimeCheckCache = new Map<string, Promise<CliRuntimeStatus>>();

function runHelp(executable: string): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    let output = '';
    let child;
    try {
      child = spawn(executable, ['--help'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: RUNTIME_CHECK_TIMEOUT_MS,
      });
    } catch {
      resolve(false);
      return;
    }
    const collect = (chunk: Buffer<ArrayBuffer>): void => {
      output += chunk.toString('utf8');
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.once('error', () => resolve(false));
    child.once('close', code => {
      resolve(code === 0 && /usage/i.test(output));
    });
  });
}

async function checkOnce(executable: string): Promise<CliRuntimeStatus> {
  return (await runHelp(executable))
    ? { ready: true, executable }
    : { ready: false, error: describeCliMissing(executable), executable };
}

export function checkWhisperCliRuntime(
  cliPath: string
): Promise<CliRuntimeStatus> {
  const executable = cliPath === '' ? DEFAULT_CLI_EXECUTABLE : cliPath;
  const cached = runtimeCheckCache.get(executable);
  if (cached != null) {
    return cached;
  }
  const pending = checkOnce(executable);
  runtimeCheckCache.set(executable, pending);
  return pending;
}

export function resetWhisperCliRuntimeCheck(): void {
  runtimeCheckCache.clear();
}

/**
 * Runs one transcription with the external whisper-cli on a temporary WAV.
 * Calling `cancelTranscriptionJob(jobId)` kills the process; the temporary
 * directory is removed on every path.
 */
export async function runWhisperCliTranscribe(options: {
  executable: string;
  jobId: string | undefined;
  request: Omit<WhisperWorkerRequest, 'type' | 'pcmf32'>;
  pcmf32: Float32Array;
  onProgress?: (percent: number) => void;
}): Promise<WhisperWorkerResult> {
  const dir = await mkdtemp(join(tmpdir(), 'minutes-whisper-'));
  let unsubscribeCancel: () => void = () => undefined;
  try {
    const wavPath = join(dir, 'input.wav');
    const outputBase = join(dir, 'output');
    await writeFile(wavPath, encodePcmF32ToWav16k(options.pcmf32));

    const args = buildWhisperCliArgs(options.request, wavPath, outputBase);
    const stderrTail = await new Promise<string>((resolve, reject) => {
      const child = spawn(options.executable, args, {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let settled = false;
      let tail = '';
      let pendingLine = '';

      const settle = (fn: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        fn();
      };

      unsubscribeCancel = onTranscriptionJobCancelled(options.jobId, () => {
        settle(() => {
          child.kill('SIGKILL');
          reject(new TranscriptionCancelledError());
        });
      });

      child.stderr.on('data', (chunk: Buffer<ArrayBuffer>) => {
        const text = chunk.toString('utf8');
        tail = (tail + text).slice(-STDERR_TAIL_BYTES);
        const lines = (pendingLine + text).split(/[\r\n]+/);
        pendingLine = lines.pop() ?? '';
        for (const line of lines) {
          const percent = parseWhisperCliProgress(line);
          if (percent != null) {
            options.onProgress?.(percent);
          }
        }
      });

      child.once('error', error => {
        settle(() =>
          reject(
            new Error(`whisper-cli se nepodařilo spustit: ${error.message}`)
          )
        );
      });

      child.once('close', (code, signal) => {
        settle(() => {
          if (code === 0) {
            resolve(tail.trim());
            return;
          }
          const status =
            code == null
              ? `whisper-cli byl ukončen signálem ${String(signal)}`
              : `whisper-cli skončil s kódem ${code}`;
          reject(new Error(`${status}: ${tail.trim()}`));
        });
      });
    });

    let json: unknown;
    try {
      json = JSON.parse(await readFile(`${outputBase}.json`, 'utf8'));
    } catch (error) {
      throw new Error(
        `whisper-cli nevytvořil platný JSON výstup (${(error as Error).message}): ${stderrTail}`
      );
    }
    return parseWhisperCliJson(json);
  } finally {
    unsubscribeCancel();
    await rm(dir, { recursive: true, force: true });
  }
}
