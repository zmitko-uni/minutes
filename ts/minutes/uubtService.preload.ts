// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import type {
  UubtAppendResponse,
  UubtMeeting,
  UubtMeetingActivity,
  UubtMeetingTexts,
  UubtSettingsPublic,
  UubtSettingsSaveInput,
} from './uubt.std.ts';

/**
 * Zapnutá integrace Plus4U se čte i ze synchronního renderu (tab Vizitky
 * v levé navigaci), proto se drží v paměti a při změně nastavení se přepočítá.
 */
let integrationEnabled = false;
const integrationListeners = new Set<(enabled: boolean) => void>();

function setIntegrationEnabled(settings: UubtSettingsPublic): void {
  const next = settings.enabled && settings.hasCredentials;
  if (next === integrationEnabled) {
    return;
  }
  integrationEnabled = next;
  for (const listener of integrationListeners) {
    listener(next);
  }
}

export function isUubtIntegrationEnabled(): boolean {
  return integrationEnabled;
}

export function subscribeUubtIntegrationEnabled(
  listener: (enabled: boolean) => void
): () => void {
  integrationListeners.add(listener);
  return () => {
    integrationListeners.delete(listener);
  };
}

export async function getUubtSettings(): Promise<UubtSettingsPublic> {
  const settings = await ipcRenderer.invoke('minutes:uubt-get-settings');
  setIntegrationEnabled(settings);
  return settings;
}

export async function saveUubtSettings(
  input: UubtSettingsSaveInput
): Promise<UubtSettingsPublic> {
  const settings = await ipcRenderer.invoke(
    'minutes:uubt-save-settings',
    input
  );
  setIntegrationEnabled(settings);
  return settings;
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

/** Přečte text přípravy a zápisu ze stránky schůzky. */
export async function loadUubtMeetingTexts(
  options: Readonly<{ meetingBaseUri: string; meetingId: string }>
): Promise<UubtMeetingTexts> {
  return ipcRenderer.invoke('minutes:uubt-load-meeting-texts', options);
}

/** Označí schůzku v Plus4U za vyřešenou (zápis je hotový). */
export async function markUubtMeetingSolved(
  activity: UubtMeetingActivity,
  note?: string
): Promise<void> {
  await ipcRenderer.invoke('minutes:uubt-mark-meeting-solved', {
    activity,
    note,
  });
}
