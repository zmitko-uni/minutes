// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export const TRANSCRIPT_METADATA_SUFFIX = '.transcript-meta.json';

export type CallTranscriptMetadata = Readonly<{
  version: 1;
  whisperModelFileName: string;
  whisperModelLabel: string;
  transcribedAt: number;
}>;
