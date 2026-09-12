// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type {
  UubtConnectionInfo,
  UubtMeeting,
  UubtMeetingActivity,
} from './uubt.std.ts';
import {
  describeValueShape,
  isSameUuIdentity,
  maskUuValueShape,
  UUBT_PEOPLE_BASE_URI,
  uuIdentityCandidates,
} from './uubt.std.ts';
import { getUubtToken } from './uubtAuth.main.ts';
import { UubtApiError, uubtGet } from './uubtClient.main.ts';

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
}> &
  Record<string, unknown>;

const dwUriCache = new Map<string, ResolvedPerson>();

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

type ResolvedPerson = Readonly<{ uuIdentity: string; person: PersonRecord }>;

/**
 * Token nemusí nést uuIdentity v podobě, kterou uuApp API přijímá, proto
 * zkoušíme všechny kandidáty z tokenu i jejich zápis s/bez pomlček.
 */
async function loadPerson(
  identityCandidates: ReadonlyArray<string>
): Promise<ResolvedPerson> {
  const cacheKey = identityCandidates.join('|');
  const cached = dwUriCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let rejected: UubtApiError | null = null;

  const attempts = identityCandidates.flatMap(candidate => [
    ...uuIdentityCandidates(candidate),
  ]);

  for (const uuIdentity of attempts) {
    let person: PersonRecord | undefined;
    try {
      // Sériově — další formát má smysl zkusit jen po odmítnutí předchozího.
      // oxlint-disable-next-line no-await-in-loop
      const response = await uubtGet<{
        itemList?: ReadonlyArray<PersonRecord>;
      }>(UUBT_PEOPLE_BASE_URI, 'findPerson', { uuIdentity });
      person = response.itemList?.[0];
    } catch (error) {
      if (error instanceof UubtApiError && error.isInvalidDtoIn) {
        log.warn(
          `uubt findPerson rejected identity shape ${maskUuValueShape(uuIdentity)}`
        );
        rejected = error;
        continue;
      }
      throw error;
    }

    if (person) {
      const resolved: ResolvedPerson = { uuIdentity, person };
      dwUriCache.set(cacheKey, resolved);
      return resolved;
    }

    log.warn(
      `uubt findPerson returned nothing for identity shape ${maskUuValueShape(uuIdentity)}`
    );
  }

  if (rejected) {
    throw new Error(
      'Plus4U nepřijal identitu z přihlašovacího tokenu. Podrobnosti (názvy claimů) jsou v Menu → Minutes → Zobrazit log.'
    );
  }

  throw new Error(
    'Pro přihlášený účet se nepodařilo najít osobu ani její pracovní prostor.'
  );
}

export function clearUubtCalendarCache(): void {
  dwUriCache.clear();
}

export async function getUubtConnectionInfo(): Promise<UubtConnectionInfo> {
  const { identityCandidates } = await getUubtToken();
  const { uuIdentity, person } = await loadPerson(identityCandidates);
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

function readNestedString(
  record: Record<string, unknown>,
  keys: ReadonlyArray<string>
): string | null {
  const containers: ReadonlyArray<unknown> = [
    record,
    record.tileProps,
    record.activity,
    record.elementaryActivityData,
  ];

  for (const container of containers) {
    if (container == null || typeof container !== 'object') {
      continue;
    }
    for (const key of keys) {
      const value = (container as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Vazba na elementární aktivitu, přes kterou se schůzka uzavírá. uuDW API
 * ji nedokumentuje; názvy polí odpovídají tvaru `uuDwRecord/listMyDiaryRecords`
 * (`id` záznamu + `tileProps.elementaryActivity*`).
 */
function toActivity(
  record: DiaryRecord,
  myUuIdentity: string
): UubtMeetingActivity | null {
  const sourceAppBaseUri = readNestedString(record, [
    'sourceAppBaseUri',
    'sourceAppUri',
  ]);
  const activityRefId = readNestedString(record, ['activityRefId', 'id']);
  const elementaryActivity = readNestedString(record, [
    'elementaryActivity',
    'elementaryActivityTypeCode',
  ]);

  if (!sourceAppBaseUri || !activityRefId || !elementaryActivity) {
    return null;
  }

  // Řešitel schůzky = ten, kdo má udělat zápis a schůzku uzavřít.
  const solverUuIdentity = readNestedString(record, ['solverMainUuIdentityId']);

  return {
    sourceAppBaseUri: sourceAppBaseUri.replace(/\/+$/, ''),
    activityRefId,
    elementaryActivity,
    stateCode: readNestedString(record, [
      'elementaryActivityStateCode',
      'activityStateCode',
    ]),
    solverName: readNestedString(record, ['solverMainUuIdentityName']),
    isMine: isSameUuIdentity(solverUuIdentity, myUuIdentity),
  };
}

function toMeeting(
  record: DiaryRecord,
  myUuIdentity: string
): UubtMeeting | null {
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
    activity: toActivity(record, myUuIdentity),
  };
}

/**
 * Schůzky uživatele pro jeden kalendářní den (YYYY-MM-DD),
 * bez odmítnutých, zrušených a legacy záznamů.
 */
export async function listUubtMeetingsForDay(
  day: string
): Promise<ReadonlyArray<UubtMeeting>> {
  const { dwUri, uuIdentity } = await getUubtConnectionInfo();

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
    .map(record => toMeeting(record, uuIdentity))
    .filter((meeting): meeting is UubtMeeting => meeting != null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Bez vazby na aktivitu nejde schůzku uzavřít — tvar záznamu si zalogujeme.
  const withoutActivity = meetings.find(meeting => meeting.activity == null);
  if (withoutActivity != null) {
    const raw = records.find(record => record.id === withoutActivity.id);
    log.warn(
      `uubt: záznam kalendáře nemá vazbu na elementární aktivitu — tvar: ${describeValueShape(raw, 2)}`
    );
  }

  log.info(`uubt: ${meetings.length} schůzek pro ${day}`);
  return meetings;
}
