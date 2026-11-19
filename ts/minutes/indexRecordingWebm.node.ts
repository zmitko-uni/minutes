// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
/* oxlint-disable signal-desktop/enforce-file-suffix -- Uses Mediabunny's Node file source/target. */

import { randomUUID } from 'node:crypto';
import { open, rename, rm } from 'node:fs/promises';
import {
  Conversion,
  FilePathSource,
  FilePathTarget,
  Input,
  Output,
  WEBM,
  WebMOutputFormat,
} from 'mediabunny';

import { createLogger } from '../logging/log.std.ts';
import { ignoreFailure } from './recordingPartialFiles.node.ts';

const log = createLogger('minutes/indexRecordingWebm');

/** Rewrite only the container of a finalized MediaRecorder stream. */
export async function indexRecordingWebm(partialPath: string): Promise<void> {
  const indexedPath = `${partialPath}.${randomUUID()}.partial`;
  let created = false;

  try {
    {
      using input = new Input({
        formats: [WEBM],
        source: new FilePathSource(partialPath),
      });
      if (!(await input.canRead())) {
        return;
      }

      const temporary = await open(indexedPath, 'wx', 0o600);
      created = true;
      await temporary.close();

      const output = new Output({
        target: new FilePathTarget(indexedPath),
        format: new WebMOutputFormat(),
      });
      const conversion = await Conversion.init({
        input,
        output,
        copy: { mode: 'forced' },
        showWarnings: false,
      });
      if (!conversion.isValid || conversion.discardedTracks.length > 0) {
        throw new Error('Cannot re-index all WebM tracks without transcoding');
      }
      try {
        await conversion.execute();
      } finally {
        if (output.state !== 'finalized' && output.state !== 'canceled') {
          await ignoreFailure(() => output.cancel());
        }
      }
    }

    {
      await using indexed = await open(indexedPath, 'r+');
      await indexed.sync();
    }
    await rename(indexedPath, partialPath);
    created = false;
  } catch (error) {
    // A full disk or a malformed stream must not cost the user the recording.
    log.warn('Keeping the original WebM after indexing failed', error);
  } finally {
    if (created) {
      await ignoreFailure(() => rm(indexedPath, { force: true }));
    }
  }
}
