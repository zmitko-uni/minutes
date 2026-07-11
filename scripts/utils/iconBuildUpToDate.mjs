// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only
// @ts-check

import { stat } from 'node:fs/promises';

/**
 * Returns true when every output exists and the source PNG was not modified
 * after the oldest generated artifact (icons are still current).
 *
 * @param {string} sourcePath
 * @param {ReadonlyArray<string>} outputPaths
 */
export async function areIconOutputsUpToDate(sourcePath, outputPaths) {
  if (outputPaths.length === 0) {
    return false;
  }

  let sourceMtimeMs;
  try {
    sourceMtimeMs = (await stat(sourcePath)).mtimeMs;
  } catch {
    return false;
  }

  let oldestOutputMtimeMs = Number.POSITIVE_INFINITY;

  for (const outputPath of outputPaths) {
    try {
      const outputMtimeMs = (await stat(outputPath)).mtimeMs;
      oldestOutputMtimeMs = Math.min(oldestOutputMtimeMs, outputMtimeMs);
    } catch {
      return false;
    }
  }

  return sourceMtimeMs <= oldestOutputMtimeMs;
}
