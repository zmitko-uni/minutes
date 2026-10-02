// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

export async function deleteCallRecording(
  recordingPath: string
): Promise<void> {
  await ipcRenderer.invoke('minutes:delete-call-recording', { recordingPath });
}

export async function saveRecordingSummary(
  recordingPath: string,
  summaryMarkdown: string
): Promise<{ summaryPath: string }> {
  return ipcRenderer.invoke('minutes:save-recording-summary', {
    recordingPath,
    summaryMarkdown,
  });
}
