// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Plus4U OIDC endpoint used for the access code 1 / access code 2 grant.
 * Overridable in settings for on-prem uuOIDC servers.
 */
export const UUBT_DEFAULT_OIDC_BASE_URI =
  'https://uuidentity.plus4u.net/uu-oidc-maing02/bb977a99f4cc4c37a2afce3fd599d0a7/oidc';

/** uuPlus4UPeople instance used to resolve the user's uuDigitalWorkspace URI. */
export const UUBT_PEOPLE_BASE_URI =
  'https://uuapp.plus4u.net/uu-plus4upeople-maing01/56ac93ddb0034de8b8e4f4b829ff7d0f';

/** Request timeout for all uuBT calls. */
export const UUBT_REQUEST_TIMEOUT_MS = 30_000;

/** Marker tags delimiting the minutes region on a meeting detail page. */
export const UUBT_SECTION_TAG_PREPARATION =
  'UuElementaryManagement.Meeting.DetailPreparation';
export const UUBT_SECTION_TAG_MINUTES =
  'UuElementaryManagement.Meeting.DetailMinutes';
export const UUBT_SECTION_TAG_BOTTOM =
  'UuElementaryManagement.Meeting.DetailBottom';

export type UubtSettingsPublic = Readonly<{
  enabled: boolean;
  /** Both access codes are stored. */
  hasCredentials: boolean;
  accessCode1Masked: string | null;
  oidcBaseUri: string;
}>;

export type UubtSettingsSaveInput = Readonly<{
  enabled: boolean;
  oidcBaseUri?: string;
  /**
   * - non-empty string = uložit novou hodnotu
   * - empty string = smazat uloženou hodnotu
   * - undefined = ponechat stávající
   */
  accessCode1?: string;
  accessCode2?: string;
}>;

export const DEFAULT_UUBT_SETTINGS: UubtSettingsPublic = {
  enabled: false,
  hasCredentials: false,
  accessCode1Masked: null,
  oidcBaseUri: UUBT_DEFAULT_OIDC_BASE_URI,
};

/** Schůzka z uuDigitalWorkspace kalendáře, do které lze zapsat zápis. */
export type UubtMeeting = Readonly<{
  id: string;
  name: string;
  /** ISO 8601 (UTC) */
  startTime: string;
  /** ISO 8601 (UTC) */
  endTime: string;
  location: string;
  organizer: string | null;
  meetingId: string;
  meetingBaseUri: string;
  meetingUrl: string | null;
}>;

export type UubtConnectionInfo = Readonly<{
  uuIdentity: string;
  personName: string | null;
  dwUri: string;
}>;

export type UubtAppendResult = Readonly<{
  meetingName: string;
  meetingUrl: string | null;
  /** Jak se zápis vložil — nová sekce, nebo připojení k poslední sekci. */
  mode: 'created-section' | 'appended-to-section';
}>;

/**
 * Duplicitní zápis není chyba — uživatel se jen musí rozhodnout,
 * jestli ho chce vložit znovu.
 */
export type UubtAppendResponse =
  | Readonly<{ status: 'ok'; result: UubtAppendResult }>
  | Readonly<{ status: 'duplicate'; message: string }>;

export function formatUubtMeetingTimeRange(meeting: UubtMeeting): string {
  const format = (value: string): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const start = format(meeting.startTime);
  const end = format(meeting.endTime);
  if (!start) {
    return '';
  }
  return end ? `${start}–${end}` : start;
}

/**
 * Vybere schůzku, která se časově nejvíc překrývá s nahrávkou.
 * Když se nepřekrývá žádná, vrátí časově nejbližší.
 */
export function pickMeetingForRecording(
  meetings: ReadonlyArray<UubtMeeting>,
  recording: Readonly<{ startedAt: number; endedAt: number }>
): UubtMeeting | null {
  let best: UubtMeeting | null = null;
  let bestOverlap = 0;
  let nearest: UubtMeeting | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const meeting of meetings) {
    const start = new Date(meeting.startTime).getTime();
    const end = new Date(meeting.endTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      continue;
    }

    const overlap =
      Math.min(end, recording.endedAt) - Math.max(start, recording.startedAt);
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = meeting;
    }

    const distance = Math.min(
      Math.abs(start - recording.startedAt),
      Math.abs(end - recording.endedAt)
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = meeting;
    }
  }

  return best ?? nearest;
}

/** Local date as YYYY-MM-DD — uuDW filtruje kalendář podle kalendářního dne. */
export function toUubtDayString(epochMs: number): string {
  const date = new Date(epochMs);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
