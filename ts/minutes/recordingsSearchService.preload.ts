// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { RecordingTextMatch } from './recordingsSearch.std.ts';

export async function searchRecordingTexts(
  query: string
): Promise<Array<RecordingTextMatch>> {
  const matches = (await ipcRenderer.invoke('minutes:search-call-recordings', {
    query,
  })) as Array<RecordingTextMatch> | undefined;
  return matches ?? [];
}
