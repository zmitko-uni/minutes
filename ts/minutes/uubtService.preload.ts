// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type {
  UubtAppendResponse,
  UubtMeeting,
  UubtSettingsPublic,
  UubtSettingsSaveInput,
} from './uubt.std.ts';

export async function getUubtSettings(): Promise<UubtSettingsPublic> {
  return ipcRenderer.invoke('minutes:uubt-get-settings');
}

export async function saveUubtSettings(
  input: UubtSettingsSaveInput
): Promise<UubtSettingsPublic> {
  return ipcRenderer.invoke('minutes:uubt-save-settings', input);
}

export async function testUubtConnection(): Promise<{
  ok: true;
  message: string;
}> {
  return ipcRenderer.invoke('minutes:uubt-test-connection');
}

export async function listUubtMeetings(
  day: string
): Promise<ReadonlyArray<UubtMeeting>> {
  return ipcRenderer.invoke('minutes:uubt-list-meetings', { day });
}

export async function appendUubtMinutes(
  options: Readonly<{
    meetingBaseUri: string;
    meetingId: string;
    meetingUrl: string | null;
    conversationTitle: string;
    recordedAt: number;
    summaryMarkdown: string;
    allowDuplicate?: boolean;
  }>
): Promise<UubtAppendResponse> {
  return ipcRenderer.invoke('minutes:uubt-append-minutes', options);
}
