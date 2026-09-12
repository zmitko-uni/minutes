// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';

import { protocol } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { isPathInside } from '../util/isPathInside.node.ts';
import { toWebStream } from '../util/toWebStream.node.ts';
import {
  RECORDING_MEDIA_SCHEME,
  getRecordingMediaContentType,
} from './recordingMedia.std.ts';

const log = createLogger('minutes/recordingMediaProtocol');

/** Chromium posílá `bytes=start-` i `bytes=start-end`. */
function parseRangeHeader(
  header: string,
  size: number
): Readonly<{ start: number; end: number }> | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (match == null) {
    return null;
  }

  const [, rawStart, rawEnd] = match;
  if (rawStart === '' && rawEnd === '') {
    return null;
  }

  // Sufix `bytes=-500` znamená posledních 500 bajtů.
  if (rawStart === '') {
    const length = Number(rawEnd);
    if (!Number.isFinite(length) || length <= 0) {
      return null;
    }
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(rawStart);
  if (!Number.isFinite(start) || start >= size) {
    return null;
  }

  const end = rawEnd === '' ? size - 1 : Number(rawEnd);
  if (!Number.isFinite(end) || end < start) {
    return null;
  }

  return { start, end: Math.min(end, size - 1) };
}

async function handleRequest(
  request: Request,
  recordingsDir: string
): Promise<Response> {
  const filePath = new URL(request.url).searchParams.get('path');
  if (filePath == null) {
    return new Response('Missing path', { status: 400 });
  }

  if (!isPathInside(filePath, recordingsDir)) {
    log.warn('odmítnuta cesta mimo složku nahrávek');
    return new Response('Access denied', { status: 403 });
  }

  let size: number;
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      return new Response('Not a file', { status: 404 });
    }
    size = fileStat.size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  const headers: Record<string, string> = {
    'accept-ranges': 'bytes',
    'cache-control': 'no-cache, no-store',
    'content-type': getRecordingMediaContentType(filePath),
  };

  const rangeHeader = request.headers.get('range');
  const range =
    rangeHeader != null ? parseRangeHeader(rangeHeader, size) : null;

  if (range == null) {
    headers['content-length'] = String(size);
    return new Response(toWebStream(createReadStream(filePath)), {
      status: 200,
      headers,
    });
  }

  headers['content-length'] = String(range.end - range.start + 1);
  headers['content-range'] = `bytes ${range.start}-${range.end}/${size}`;
  return new Response(
    toWebStream(
      createReadStream(filePath, { start: range.start, end: range.end })
    ),
    { status: 206, headers }
  );
}

export function registerRecordingMediaProtocol(recordingsDir: string): void {
  protocol.handle(RECORDING_MEDIA_SCHEME, request =>
    handleRequest(request, recordingsDir)
  );
}
