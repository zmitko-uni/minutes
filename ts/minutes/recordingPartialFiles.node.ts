// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

export const DEFAULT_PARTIAL_RETENTION_MS = 24 * 60 * 60_000;

export type RecordingPartialFileError = Error & Readonly<{ partialPath: string }>;

export function createRecordingPartialFileError(
  message: string,
  partialPath: string,
  name = 'RecordingPartialFileError'
): RecordingPartialFileError {
  return Object.assign(new Error(message), {
    name,
    partialPath,
  });
}

export function isRecordingPartialFileError(
  error: unknown
): error is RecordingPartialFileError {
  return (
    error instanceof Error &&
    'partialPath' in error &&
    typeof error.partialPath === 'string'
  );
}

export async function ignoreFailure(
  operation: () => Promise<unknown>
): Promise<void> {
  try {
    await operation();
  } catch {
    // Best-effort cleanup must not hide the original recording error.
  }
}

export async function reapStaleRecordingPartials(
  directory: string,
  {
    now = Date.now(),
    maxAgeMs = DEFAULT_PARTIAL_RETENTION_MS,
    suffix = '.partial',
  }: Readonly<{
    now?: number;
    maxAgeMs?: number;
    suffix?: string;
  }> = {}
): Promise<Array<string>> {
  let fileNames: ReadonlyArray<string>;
  try {
    fileNames = await readdir(directory);
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

  const removed = new Array<string>();
  for (const fileName of [...fileNames].sort()) {
    if (!fileName.endsWith(suffix)) {
      continue;
    }
    const path = join(directory, fileName);
    try {
      // eslint-disable-next-line no-await-in-loop
      const metadata = await stat(path);
      if (!metadata.isFile() || now - metadata.mtimeMs < maxAgeMs) {
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      await rm(path, { force: true });
      removed.push(path);
    } catch {
      // A concurrent cleanup or inaccessible orphan must not block startup.
    }
  }
  return removed;
}

export function sanitizeRecordingFilePart(value: string): string {
  return value
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 80);
}

export function formatTimestampForRecordingFilename(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/[:.]/g, '-');
}

export function parseRecordingTimestampFromBaseName(
  baseName: string
): number | null {
  const timestampPart = baseName.split('_')[0];
  if (timestampPart == null || timestampPart.length === 0) {
    return null;
  }
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d+)Z$/.exec(timestampPart);
  if (match == null) {
    return null;
  }
  const [, date, hours, minutes, seconds, millis] = match;
  const iso = `${date}T${hours}:${minutes}:${seconds}.${millis}Z`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRecordingTitleFromBaseName(baseName: string): string {
  const parts = baseName.split('_');
  if (parts.length < 3) {
    return baseName;
  }
  return parts.slice(1, -1).join(' ').replace(/_/g, ' ');
}
