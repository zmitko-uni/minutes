// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  chmod,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  cancelTranscriptionJob,
  TranscriptionCancelledError,
} from '../../minutes/transcriptionCancel.main.ts';
import {
  checkWhisperCliRuntime,
  resetWhisperCliRuntimeCheck,
  runWhisperCliTranscribe,
} from '../../minutes/whisperCliProcess.main.ts';

const REQUEST = {
  modelPath: '/m/ggml-tiny.bin',
  useGpu: false,
  gpuDeviceIndex: 0,
  threadCount: 2,
  language: 'cs',
  prompt: '',
  profile: { temperature: 0, beam_size: 5, best_of: 2 },
  useVad: false,
  vadModelPath: '',
};

const SEGMENT_JSON = JSON.stringify({
  result: { language: 'cs' },
  transcription: [
    {
      timestamps: { from: '00:00:00,000', to: '00:00:04,000' },
      offsets: { from: 0, to: 4000 },
      text: ' ahoj světe',
    },
  ],
});

async function listWhisperTempDirs(): Promise<Array<string>> {
  const names = await readdir(tmpdir());
  return names.filter(name => name.startsWith('minutes-whisper-'));
}

describe('minutes/whisperCliProcess', () => {
  let fakeDir: string;
  let counter = 0;

  before(async () => {
    fakeDir = await mkdtemp(join(tmpdir(), 'minutes fake čli-'));
  });

  after(async () => {
    await rm(fakeDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    resetWhisperCliRuntimeCheck();
  });

  async function writeFake(body: string): Promise<string> {
    counter += 1;
    const path = join(fakeDir, `whisper-cli-${counter}`);
    await writeFile(
      path,
      `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const of = args[args.indexOf('-of') + 1];
${body}
`
    );
    await chmod(path, 0o755);
    return path;
  }

  function run(
    executable: string,
    extra: { jobId?: string; onProgress?: (percent: number) => void } = {}
  ): ReturnType<typeof runWhisperCliTranscribe> {
    return runWhisperCliTranscribe({
      executable,
      jobId: extra.jobId,
      request: REQUEST,
      pcmf32: new Float32Array([0, 0.5, -0.5]),
      onProgress: extra.onProgress,
    });
  }

  it('resolves with the segment, reports progress and removes the temp dir', async () => {
    const before = await listWhisperTempDirs();
    const executable = await writeFake(`
process.stderr.write('whisper_print_progress_callback: progress =  50%\\n');
fs.writeFileSync(of + '.json', ${JSON.stringify(SEGMENT_JSON)});
`);
    const percents: Array<number> = [];
    const result = await run(executable, {
      onProgress: percent => percents.push(percent),
    });
    assert.deepEqual(result, {
      segments: [
        { start: '00:00:00,000', end: '00:00:04,000', text: 'ahoj světe' },
      ],
      language: 'cs',
    });
    assert.deepEqual(percents, [50]);
    assert.deepEqual(await listWhisperTempDirs(), before);
  });

  it('rejects when exit 0 without JSON, including the stderr tail', async () => {
    const executable = await writeFake(
      `process.stderr.write('chybí výstup\\n');`
    );
    let error: Error | undefined;
    try {
      await run(executable);
    } catch (e) {
      error = e as Error;
    }
    assert.isDefined(error);
    assert.include(error?.message, 'whisper-cli');
    assert.include(error?.message, 'chybí výstup');
  });

  it('rejects on non-zero exit with code and stderr tail', async () => {
    const executable = await writeFake(`
process.stderr.write("error: model file not found 'x'\\n");
process.exit(3);
`);
    let error: Error | undefined;
    try {
      await run(executable);
    } catch (e) {
      error = e as Error;
    }
    assert.include(error?.message, 'whisper-cli skončil s kódem 3');
    assert.include(error?.message, 'model file not found');
  });

  it('cancel kills the process and removes the temp dir', async () => {
    const before = await listWhisperTempDirs();
    const marker = join(fakeDir, 'cancel-pid');
    const executable = await writeFake(`
fs.writeFileSync(${JSON.stringify(marker)}, String(process.pid));
setInterval(() => undefined, 1000);
`);
    const promise = run(executable, { jobId: 'job-cancel-1' });
    const waitForPid = async (): Promise<number> => {
      for (let i = 0; i < 100; i += 1) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const text = await readFile(marker, 'utf8');
          if (text !== '') {
            return Number(text);
          }
        } catch {
          // not yet written
        }
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      throw new Error('fake whisper-cli did not start');
    };
    const pid = await waitForPid();
    cancelTranscriptionJob('job-cancel-1');
    let error: unknown;
    try {
      await promise;
    } catch (e) {
      error = e;
    }
    assert.instanceOf(error, TranscriptionCancelledError);
    assert.deepEqual(await listWhisperTempDirs(), before);
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.throws(() => process.kill(pid, 0));
  });

  it('cancel during setup rejects without spawning and removes the temp dir', async () => {
    const before = await listWhisperTempDirs();
    const marker = join(fakeDir, 'setup-cancel-spawned');
    const executable = await writeFake(
      `fs.writeFileSync(${JSON.stringify(marker)}, 'spawned');`
    );
    const promise = run(executable, { jobId: 'job-cancel-setup' });
    cancelTranscriptionJob('job-cancel-setup');
    let error: unknown;
    try {
      await promise;
    } catch (e) {
      error = e;
    }
    assert.instanceOf(error, TranscriptionCancelledError);
    assert.deepEqual(await listWhisperTempDirs(), before);
    await new Promise(resolve => setTimeout(resolve, 200));
    let spawned = true;
    try {
      await readFile(marker, 'utf8');
    } catch {
      spawned = false;
    }
    assert.isFalse(spawned);
  });

  describe('checkWhisperCliRuntime', () => {
    it('reports not found for a missing executable', async () => {
      assert.deepEqual(
        await checkWhisperCliRuntime('/nonexistent/whisper-cli'),
        {
          ready: false,
          error: 'whisper-cli nenalezen (/nonexistent/whisper-cli)',
          executable: '/nonexistent/whisper-cli',
        }
      );
    });

    it('is ready when --help exits 0 and mentions usage', async () => {
      const executable = await writeFake(
        `process.stderr.write('usage: whisper-cli [options]\\n');`
      );
      assert.deepEqual(await checkWhisperCliRuntime(executable), {
        ready: true,
        executable,
      });
    });

    it('re-checks a missing executable instead of caching the failure', async () => {
      counter += 1;
      const executable = join(fakeDir, `late-whisper-cli-${counter}`);
      assert.isFalse((await checkWhisperCliRuntime(executable)).ready);

      await writeFile(
        executable,
        `#!/usr/bin/env node
process.stderr.write('usage: whisper-cli [options]\\n');
`
      );
      await chmod(executable, 0o755);

      assert.deepEqual(await checkWhisperCliRuntime(executable), {
        ready: true,
        executable,
      });
    });

    it('uses the default executable for an empty path', async () => {
      const status = await checkWhisperCliRuntime('');
      assert.equal(status.executable, 'whisper-cli');
    });
  });
});
