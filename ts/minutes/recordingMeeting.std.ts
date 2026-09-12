// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { UubtMeetingActivity } from './uubt.std.ts';

/**
 * Vazba nahrávky na schůzku v Plus4U. Ukládá se souborově k nahrávce
 * (`<nahrávka>.meeting.json`), aby po restartu bylo jasné, kam zápis šel.
 */
export type RecordingMeetingLink = Readonly<{
  version: 1;
  meetingId: string;
  meetingBaseUri: string;
  meetingUrl: string | null;
  name: string;
  /** ISO 8601 (UTC) */
  startTime: string;
  /** ISO 8601 (UTC) */
  endTime: string;
  location: string;
  organizer: string | null;
  /** Kdy jsme zápis vložili. */
  insertedAt: number;
  /** Jak se zápis vložil — nová sekce, nebo připojení k poslední. */
  mode: 'created-section' | 'appended-to-section';
  /**
   * Vazba na elementární aktivitu, přes kterou se schůzka uzavírá.
   * Chybí u vazeb uložených dřív a u záznamů, kde ji kalendář nevrátil.
   */
  activity?: UubtMeetingActivity | null;
}>;

export function isRecordingMeetingLink(
  value: unknown
): value is RecordingMeetingLink {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<RecordingMeetingLink>;
  return (
    candidate.version === 1 &&
    typeof candidate.meetingId === 'string' &&
    typeof candidate.meetingBaseUri === 'string' &&
    typeof candidate.name === 'string'
  );
}

export function formatMeetingDay(link: RecordingMeetingLink): string {
  const date = new Date(link.startTime);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatMeetingInsertedAt(link: RecordingMeetingLink): string {
  try {
    return new Date(link.insertedAt).toLocaleString('cs-CZ');
  } catch {
    return '';
  }
}

export function formatMeetingInsertMode(link: RecordingMeetingLink): string {
  return link.mode === 'created-section'
    ? 'zápis vložen jako nová sekce'
    : 'zápis připojen k poslední sekci';
}
