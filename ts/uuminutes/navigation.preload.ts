// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { openReadmeModal } from './readmeService.preload.ts';

export async function openRecordingsFolder(): Promise<void> {
  await ipcRenderer.invoke('uuminutes:open-recordings-folder');
}

export async function openSummariesFolder(): Promise<void> {
  await ipcRenderer.invoke('uuminutes:open-summaries-folder');
}

export function openReadme(): void {
  openReadmeModal();
}

export function openUuMinutesLog(): void {
  ipcRenderer.send('uuminutes:open-log');
}
