// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile, writeFile } from 'node:fs/promises';

import {
  TRANSCRIPT_METADATA_SUFFIX,
  type CallTranscriptMetadata,
} from './transcriptMetadata.std.ts';

export function getTranscriptMetadataPath(basePath: string): string {
  return `${basePath}${TRANSCRIPT_METADATA_SUFFIX}`;
}

export async function writeCallTranscriptMetadata(
  basePath: string,
  metadata: Omit<CallTranscriptMetadata, 'version'>
): Promise<void> {
  const payload: CallTranscriptMetadata = {
    version: 1,
    ...metadata,
  };
  await writeFile(
    getTranscriptMetadataPath(basePath),
    JSON.stringify(payload, null, 2),
    'utf8'
  );
}

export async function readCallTranscriptMetadata(
  basePath: string
): Promise<CallTranscriptMetadata | null> {
  try {
    const raw = await readFile(getTranscriptMetadataPath(basePath), 'utf8');
    const parsed = JSON.parse(raw) as Partial<CallTranscriptMetadata>;
    if (
      parsed.version !== 1 ||
      typeof parsed.whisperModelFileName !== 'string' ||
      typeof parsed.whisperModelLabel !== 'string' ||
      typeof parsed.transcribedAt !== 'number'
    ) {
      return null;
    }
    return {
      version: 1,
      whisperModelFileName: parsed.whisperModelFileName,
      whisperModelLabel: parsed.whisperModelLabel,
      transcribedAt: parsed.transcribedAt,
    };
  } catch {
    return null;
  }
}
