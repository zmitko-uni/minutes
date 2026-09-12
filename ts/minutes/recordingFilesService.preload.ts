// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type { RecordingMeetingLink } from './recordingMeeting.std.ts';

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

export async function getRecordingMeeting(
  recordingPath: string
): Promise<RecordingMeetingLink | null> {
  return ipcRenderer.invoke('minutes:get-recording-meeting', { recordingPath });
}

export async function saveRecordingMeeting(
  recordingPath: string,
  link: RecordingMeetingLink
): Promise<RecordingMeetingLink> {
  return ipcRenderer.invoke('minutes:save-recording-meeting', {
    recordingPath,
    link,
  });
}
