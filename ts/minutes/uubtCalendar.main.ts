// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { UubtConnectionInfo, UubtMeeting } from './uubt.std.ts';
import { UUBT_PEOPLE_BASE_URI } from './uubt.std.ts';
import { getUubtToken } from './uubtAuth.main.ts';
import { uubtGet } from './uubtClient.main.ts';

const log = createLogger('minutes/uubtCalendar');

type PersonRecord = Record<string, unknown> & {
  name?: string;
  fullName?: string;
  digitalWorkspaceUri?: string;
  dwUri?: string;
  myTerritoryUri?: string;
  diaryWorkspaceUri?: string;
};

type DiaryRecord = Readonly<{
  id?: string;
  name?: string;
  desc?: string;
  startTime?: string;
  endTime?: string;
  rejected?: boolean;
  routeUri?: string;
  tileProps?: Readonly<{
    appUri?: string;
    artifactStateCode?: string;
    submitterMainUuIdentityName?: string;
    artifact?: Readonly<{ stateName?: string }>;
  }>;
}>;

const dwUriCache = new Map<string, PersonRecord>();

function findDwUri(person: PersonRecord): string | null {
  const direct =
    person.digitalWorkspaceUri ??
    person.dwUri ??
    person.myTerritoryUri ??
    person.diaryWorkspaceUri;
  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  for (const value of Object.values(person)) {
    if (typeof value === 'string' && value.includes('dwg01')) {
      return value;
    }
  }
  return null;
}

async function loadPerson(uuIdentity: string): Promise<PersonRecord> {
  const cached = dwUriCache.get(uuIdentity);
  if (cached) {
    return cached;
  }

  const response = await uubtGet<{ itemList?: ReadonlyArray<PersonRecord> }>(
    UUBT_PEOPLE_BASE_URI,
    'findPerson',
    { uuIdentity }
  );

  const person = response.itemList?.[0];
  if (!person) {
    throw new Error(
      'Pro přihlášený účet se nepodařilo najít osobu ani její pracovní prostor.'
    );
  }

  dwUriCache.set(uuIdentity, person);
  return person;
}

export function clearUubtCalendarCache(): void {
  dwUriCache.clear();
}

export async function getUubtConnectionInfo(): Promise<UubtConnectionInfo> {
  const { uuIdentity } = await getUubtToken();
  const person = await loadPerson(uuIdentity);
  const dwUri = findDwUri(person);

  if (!dwUri) {
    throw new Error(
      'Přihlášení proběhlo, ale nepodařilo se najít uuDigitalWorkspace (dwg01) uživatele.'
    );
  }

  const personName =
    (typeof person.name === 'string' && person.name) ||
    (typeof person.fullName === 'string' && person.fullName) ||
    null;

  return { uuIdentity, personName, dwUri: dwUri.replace(/\/+$/, '') };
}

function stripUu5Tags(value: string | undefined): string {
  return (value ?? '')
    .replace(/<uu5string\s*\/?>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toMeeting(record: DiaryRecord): UubtMeeting | null {
  const appUriString = record.tileProps?.appUri;
  if (!appUriString) {
    // Legacy záznam bez vazby na uuElementaryManagement — zápis tam vložit nelze.
    return null;
  }

  let appUri: URL;
  try {
    appUri = new URL(appUriString);
  } catch {
    return null;
  }

  const meetingId = appUri.searchParams.get('id');
  if (!meetingId) {
    return null;
  }

  const artifactState =
    record.tileProps?.artifactStateCode ??
    record.tileProps?.artifact?.stateName ??
    null;
  if (artifactState === 'cancelled' || record.rejected === true) {
    return null;
  }

  const meetingBaseUri = `${appUri.origin}/${appUri.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, 2)
    .join('/')}`;

  return {
    id: record.id ?? meetingId,
    name: (record.name ?? '').trim() || 'Bez názvu',
    startTime: record.startTime ?? '',
    endTime: record.endTime ?? '',
    location: stripUu5Tags(record.desc),
    organizer: record.tileProps?.submitterMainUuIdentityName ?? null,
    meetingId,
    meetingBaseUri,
    meetingUrl: appUriString,
  };
}

/**
 * Schůzky uživatele pro jeden kalendářní den (YYYY-MM-DD),
 * bez odmítnutých, zrušených a legacy záznamů.
 */
export async function listUubtMeetingsForDay(
  day: string
): Promise<ReadonlyArray<UubtMeeting>> {
  const { dwUri } = await getUubtConnectionInfo();

  const response = await uubtGet<{
    uuDwrActiveList?: ReadonlyArray<DiaryRecord>;
    uuDwrFinalList?: ReadonlyArray<DiaryRecord>;
  }>(dwUri, 'uuDwRecord/listMyDiaryRecords', {
    dateFrom: day,
    dateTo: day,
    'pageInfo.pageSize': 1000,
  });

  const records = [
    ...(response.uuDwrActiveList ?? []),
    ...(response.uuDwrFinalList ?? []),
  ];

  const meetings = records
    .map(toMeeting)
    .filter((meeting): meeting is UubtMeeting => meeting != null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  log.info(`uubt: ${meetings.length} schůzek pro ${day}`);
  return meetings;
}
