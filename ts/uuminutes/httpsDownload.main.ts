// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createWriteStream, type WriteStream } from 'node:fs';
import { get as httpsGet, type ClientRequest } from 'node:https';

export class DownloadCancelledError extends Error {
  constructor() {
    super('Stažení bylo zrušeno.');
    this.name = 'DownloadCancelledError';
  }
}

export type DownloadHttpsFileOptions = Readonly<{
  signal?: AbortSignal;
}>;

export function downloadHttpsFile(
  url: string,
  destination: string,
  onProgress: (loaded: number, total: number | null) => void,
  options: DownloadHttpsFileOptions = {}
): Promise<void> {
  const { signal } = options;

  if (signal?.aborted) {
    return Promise.reject(new DownloadCancelledError());
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let request: ClientRequest | null = null;
    let fileStream: WriteStream | null = null;

    const finish = (error?: Error): void => {
      if (settled) {
        return;
      }
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      request?.destroy();
      fileStream?.destroy();

      if (error instanceof DownloadCancelledError || signal?.aborted) {
        reject(new DownloadCancelledError());
        return;
      }
      if (error) {
        reject(error);
        return;
      }
      resolve();
    };

    const onAbort = (): void => {
      finish(new DownloadCancelledError());
    };

    signal?.addEventListener('abort', onAbort);

    request = httpsGet(url, response => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        request = null;
        downloadHttpsFile(response.headers.location, destination, onProgress, {
          signal,
        })
          .then(() => finish())
          .catch(error => finish(error instanceof Error ? error : new Error(String(error))));
        response.resume();
        return;
      }

      if (response.statusCode !== 200) {
        finish(
          new Error(
            `Stažení souboru selhalo (HTTP ${response.statusCode ?? 'unknown'})`
          )
        );
        response.resume();
        return;
      }

      const total = Number(response.headers['content-length'] ?? 0) || null;
      let loaded = 0;
      fileStream = createWriteStream(destination);

      response.on('data', chunk => {
        if (signal?.aborted) {
          finish(new DownloadCancelledError());
          return;
        }
        loaded += chunk.length;
        onProgress(loaded, total);
      });

      response.pipe(fileStream);
      fileStream.on('finish', () => finish());
      fileStream.on('error', error => finish(error));
      response.on('error', error => finish(error));
    });

    request.on('error', error => finish(error));
  });
}
