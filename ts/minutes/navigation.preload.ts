// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { openReadmeModal } from './readmeService.preload.ts';

export async function openRecordingsFolder(): Promise<void> {
  await ipcRenderer.invoke('minutes:open-recordings-folder');
}

export async function openSummariesFolder(): Promise<void> {
  await ipcRenderer.invoke('minutes:open-summaries-folder');
}

export function openReadme(): void {
  openReadmeModal();
}

export function openMinutesLog(): void {
  ipcRenderer.send('minutes:open-log');
}
