// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type { PersonContact, PersonName } from './personCard.std.ts';
import { EMPTY_PERSON_NAME } from './personCard.std.ts';
import {
  maskUuValueShape,
  UUBT_PEOPLE_BASE_URI,
  uuIdentityCandidates,
} from './uubt.std.ts';
import { getUubtTokenWithInteractiveLogin } from './uubtAuthSession.main.ts';
import { UubtApiError, uubtGet, uubtGetBinary } from './uubtClient.main.ts';

const log = createLogger('minutes/plus4uPeople');

/** Profily osob podle jména; `private=false` vynechá soukromé záznamy. */
const FIND_BY_NAME_USE_CASE = 'people/findPerson';

/** Profil osoby podle uuIdentity — používá ho i kalendář na dohledání uuDW. */
const FIND_BY_IDENTITY_USE_CASE = 'findPerson';

/**
 * Kontakty drží Plus4U People na „osobní vizitce“ (personalCard), ne
 * u záznamu osoby — `person/listMTInfoByUuIdentityList` vrací jen odkazy na
 * uuMyTerritory. Který z příkazů vizitku vydá, dokumentace neříká, takže se
 * zkoušejí popořadě a ten, který projde, se zapamatuje na zbytek běhu.
 */
const CONTACT_CARD_USE_CASES: ReadonlyArray<string> = [
  'personalCard/load',
  'personalCard/get',
];

let workingContactUseCase: string | null = null;

/** Fotky osob uuBEM nemá, servíruje je Plus4U People — a to přímo jako JPEG. */
const PHOTO_USE_CASE = 'getPersonPhotoByUuIdentity';

export type Plus4uPersonRecord = Record<string, unknown> & {
  name?: string;
  fullName?: string;
  digitalWorkspaceUri?: string;
  dwUri?: string;
  myTerritoryUri?: string;
  diaryWorkspaceUri?: string;
};

export type Plus4uPersonProfile = Readonly<{
  uuIdentity: string;
  name: PersonName;
}>;

export type Plus4uPersonContacts = Readonly<{
  phoneList: ReadonlyArray<PersonContact>;
  emailList: ReadonlyArray<PersonContact>;
  addressList: ReadonlyArray<string>;
  /** Syrové hodnoty z polí, která vypadají na Signal — parsují se až v UI. */
  signalUris: ReadonlyArray<string>;
}>;

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function toRecordList(value: unknown): ReadonlyArray<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/**
 * Plus4U People je nedokumentované API, takže se seznam nehledá podle jednoho
 * názvu pole — bere se první pole objektů, ať už se jmenuje jakkoliv.
 */
function pickRecordList(
  value: unknown
): ReadonlyArray<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return toRecordList(value);
  }
  if (!isRecord(value)) {
    return [];
  }

  const preferred = ['itemList', 'personList', 'peopleList', 'mtInfoList'];
  for (const key of preferred) {
    const candidate = value[key];
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord);
    }
  }

  for (const nested of Object.values(value)) {
    if (Array.isArray(nested)) {
      const records = nested.filter(isRecord);
      if (records.length > 0) {
        return records;
      }
    }
  }
  return [];
}

/**
 * Plus4U People jméno někdy rozepisuje do polí jako uuBEM, jindy pošle jen
 * jedno `name` s celým jménem. Druhý případ se rozdělí na křestní a příjmení,
 * ať se dá osoba spárovat a zobrazit stejně jako vizitka z uuBEM.
 */
function parsePersonName(source: Record<string, unknown>): PersonName {
  const surname =
    readString(source, 'surname') || readString(source, 'lastName');
  // `people/findPerson` posílá celé jméno v `name`, osobní vizitka `firstname`.
  const given =
    readString(source, 'name') ||
    readString(source, 'firstname') ||
    readString(source, 'firstName');

  if (surname.length > 0) {
    return {
      titleBefore: readString(source, 'titleBefore'),
      name: given,
      middleName: readString(source, 'middleName'),
      surname,
      suffix: readString(source, 'suffix'),
      titleAfter: readString(source, 'titleAfter'),
    };
  }

  const full = given || readString(source, 'fullName');
  const parts = full.split(/\s+/).filter(part => part.length > 0);
  if (parts.length === 0) {
    return EMPTY_PERSON_NAME;
  }

  return {
    ...EMPTY_PERSON_NAME,
    name: parts.slice(0, -1).join(' '),
    surname: parts[parts.length - 1] ?? '',
  };
}

function parseProfile(
  source: Record<string, unknown>
): Plus4uPersonProfile | null {
  const uuIdentity =
    readString(source, 'uuIdentity') || readString(source, 'mainUuIdentity');
  if (uuIdentity.length === 0) {
    return null;
  }
  return { uuIdentity, name: parsePersonName(source) };
}

/**
 * Plus4U People na obecný dotaz vrátí useknutý seznam a do `uuAppErrorMap`
 * přidá varování `tooManyResults` s celkovým počtem. Bez něj by uživatel
 * nepoznal, že mu chybí většina výsledků.
 */
function readTooManyResultsTotal(response: unknown): number | null {
  if (!isRecord(response)) {
    return null;
  }
  const errorMap = response.uuAppErrorMap;
  if (!isRecord(errorMap)) {
    return null;
  }

  for (const [code, entry] of Object.entries(errorMap)) {
    if (!/tooManyResults/i.test(code) || !isRecord(entry)) {
      continue;
    }
    const paramMap = entry.paramMap;
    const total = isRecord(paramMap) ? paramMap.total : undefined;
    return typeof total === 'number' ? total : Number.POSITIVE_INFINITY;
  }
  return null;
}

export type Plus4uPeopleSearchResult = Readonly<{
  profiles: ReadonlyArray<Plus4uPersonProfile>;
  /** Kolik osob dotazu odpovídá celkem; `null`, když se nic neuseklo. */
  totalCount: number | null;
}>;

/** Profily osob odpovídající hledanému jménu. */
export async function findPlus4uPeopleByName(
  searchString: string
): Promise<Plus4uPeopleSearchResult> {
  const response = await uubtGet<unknown>(
    UUBT_PEOPLE_BASE_URI,
    FIND_BY_NAME_USE_CASE,
    { name: searchString, private: 'false' }
  );

  const profiles = pickRecordList(response)
    .map(parseProfile)
    .filter((profile): profile is Plus4uPersonProfile => profile != null);

  const totalCount = readTooManyResultsTotal(response);
  log.info(
    `plus4uPeople findPerson vrátil ${profiles.length} osob${
      totalCount == null ? '' : ` (celkem ${totalCount})`
    }`
  );
  return { profiles, totalCount };
}

const profileCache = new Map<string, Plus4uPersonProfile | null>();

/** Profil osoby podle uuIdentity, `null` když ji Plus4U People nezná. */
export async function loadPlus4uPersonProfile(
  uuIdentity: string
): Promise<Plus4uPersonProfile | null> {
  const key = uuIdentity.trim();
  if (key.length === 0) {
    return null;
  }

  const cached = profileCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const response = await uubtGet<unknown>(
    UUBT_PEOPLE_BASE_URI,
    FIND_BY_IDENTITY_USE_CASE,
    { uuIdentity: key }
  );
  const profile =
    pickRecordList(response)
      .map(parseProfile)
      .find((item): item is Plus4uPersonProfile => item != null) ?? null;

  profileCache.set(key, profile);
  return profile;
}

/** Položka v `contactMap` — `{ subtype, primary, value }`. */
type ContactEntry = Readonly<{
  value: string;
  subtype: string;
  primary: boolean;
}>;

function parseContactEntries(value: unknown): ReadonlyArray<ContactEntry> {
  return toRecordList(value)
    .map(item => ({
      value: readString(item, 'value'),
      subtype: readString(item, 'subtype'),
      primary: item.primary === true,
    }))
    .filter(item => item.value.length > 0);
}

/** Hlavní kontakt patří nahoru, jinak se pořadí z vizitky zachová. */
function toPersonContacts(
  entries: ReadonlyArray<ContactEntry>
): ReadonlyArray<PersonContact> {
  return [...entries]
    .sort((left, right) => Number(right.primary) - Number(left.primary))
    .map(entry => ({
      value: entry.value,
      description: entry.subtype,
      sources: ['plus4u-people'] as const,
    }));
}

/**
 * Signal kontakt nemá na osobní vizitce vlastní seznam — bývá zapsaný jako
 * položka s podtypem „signal“, nebo jako odkaz signal.me mezi ostatními.
 */
function collectSignalValues(
  contactMap: Record<string, unknown>
): ReadonlyArray<string> {
  const found = new Set<string>();

  for (const [listName, list] of Object.entries(contactMap)) {
    for (const entry of parseContactEntries(list)) {
      if (
        /signal/i.test(`${listName} ${entry.subtype}`) ||
        /signal\.me/i.test(entry.value)
      ) {
        found.add(entry.value);
      }
    }
  }

  return [...found];
}

/** Adresa je objekt neznámé struktury — poskládá se z jeho textových polí. */
function formatCardAddress(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (!isRecord(value)) {
    return '';
  }

  return Object.values(value)
    .filter((part): part is string => typeof part === 'string')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(', ');
}

/**
 * Osobní vizitka osoby. `null`, když ji v Plus4U People nemá — chybějící
 * vizitka není chyba, jen o osobě nejsou žádné kontakty.
 */
async function loadPersonalCard(uuIdentity: string): Promise<unknown> {
  const attempts =
    workingContactUseCase == null
      ? CONTACT_CARD_USE_CASES
      : [workingContactUseCase];

  for (const useCase of attempts) {
    try {
      // Sériově — další příkaz má smysl zkusit až po odmítnutí předchozího.
      // oxlint-disable-next-line no-await-in-loop
      const response = await uubtGet<unknown>(UUBT_PEOPLE_BASE_URI, useCase, {
        uuIdentity,
      });
      workingContactUseCase = useCase;
      return response;
    } catch (error) {
      // Chybu oprávnění musí uživatel vidět, zbytek znamená „zkus jinak“.
      if (
        error instanceof UubtApiError &&
        error.status !== 401 &&
        error.status !== 403
      ) {
        log.warn(`plus4uPeople ${useCase} vizitku nevydal: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  return null;
}

const EMPTY_CONTACTS: Plus4uPersonContacts = {
  phoneList: [],
  emailList: [],
  addressList: [],
  signalUris: [],
};

/** Telefony, e-maily, adresy a Signal kontakty osoby z Plus4U People. */
export async function loadPlus4uPersonContacts(
  uuIdentity: string
): Promise<Plus4uPersonContacts> {
  const response = await loadPersonalCard(uuIdentity);
  const contactMap =
    isRecord(response) && isRecord(response.contactMap)
      ? response.contactMap
      : null;

  if (contactMap == null) {
    return EMPTY_CONTACTS;
  }

  // Signal se mezi telefony ani e-maily opakovat nemá, patří k tlačítkům.
  const signalUris = collectSignalValues(contactMap);
  const withoutSignal = (
    entries: ReadonlyArray<ContactEntry>
  ): ReadonlyArray<ContactEntry> =>
    entries.filter(entry => !signalUris.includes(entry.value));

  return {
    phoneList: toPersonContacts(
      withoutSignal(parseContactEntries(contactMap.phoneList))
    ),
    emailList: toPersonContacts(
      withoutSignal(parseContactEntries(contactMap.emailList))
    ),
    addressList: toRecordList(contactMap.addressList)
      .map(item => formatCardAddress(item.value))
      .filter(text => text.length > 0),
    signalUris,
  };
}

/**
 * Seznam výsledků si řekne o fotku pro každý řádek, takže bez cache by se
 * stejné osoby stahovaly znovu při každém hledání. `null` (osoba fotku nemá)
 * cachujeme taky — jinak bychom to zkoušeli pořád dokola.
 */
const photoCache = new Map<string, string | null>();

const PHOTO_CACHE_LIMIT = 300;

/**
 * Seznam výsledků si řekne o fotku pro každý řádek naráz. Bez omezení jich
 * Plus4U dostane desítky současně, vyčerpají spojení a všechny spadnou na
 * timeout — proto se pouští po malých dávkách.
 */
const PHOTO_CONCURRENCY = 4;

let runningPhotoRequests = 0;
const waitingPhotoRequests: Array<() => void> = [];

async function acquirePhotoSlot(): Promise<void> {
  if (runningPhotoRequests >= PHOTO_CONCURRENCY) {
    await new Promise<void>(resolve => {
      waitingPhotoRequests.push(resolve);
    });
  }
  runningPhotoRequests += 1;
}

function releasePhotoSlot(): void {
  runningPhotoRequests -= 1;
  waitingPhotoRequests.shift()?.();
}

/** Fotka osoby jako data URL, nebo `null` když ji v Plus4U nemá. */
export async function loadPlus4uPersonPhoto(
  uuIdentity: string
): Promise<string | null> {
  const key = uuIdentity.trim();
  if (key.length === 0) {
    return null;
  }

  const cached = photoCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  await acquirePhotoSlot();

  let dataUrl: string | null = null;
  try {
    // Ve frontě mohl tutéž fotku mezitím stáhnout někdo před námi.
    const cachedAfterWait = photoCache.get(key);
    if (cachedAfterWait !== undefined) {
      return cachedAfterWait;
    }

    const photo = await uubtGetBinary(UUBT_PEOPLE_BASE_URI, PHOTO_USE_CASE, {
      uuIdentity: key,
    });
    if (photo) {
      dataUrl = `data:${photo.contentType};base64,${photo.data.toString('base64')}`;
    }
  } catch (error) {
    // Fotka je jen ozdoba — když se nepovede, vizitka musí zůstat funkční.
    log.warn(
      `plus4uPeople fotka pro ${key} se nepodařila načíst: ${String(error)}`
    );
    return null;
  } finally {
    releasePhotoSlot();
  }

  if (photoCache.size >= PHOTO_CACHE_LIMIT) {
    const oldest = photoCache.keys().next().value;
    if (oldest !== undefined) {
      photoCache.delete(oldest);
    }
  }
  photoCache.set(key, dataUrl);

  return dataUrl;
}

export type ResolvedPlus4uPerson = Readonly<{
  uuIdentity: string;
  person: Plus4uPersonRecord;
}>;

const myPersonCache = new Map<string, ResolvedPlus4uPerson>();

/**
 * Token nemusí nést uuIdentity v podobě, kterou uuApp API přijímá, proto
 * zkoušíme všechny kandidáty z tokenu i jejich zápis s/bez pomlček.
 */
export async function loadPlus4uPersonByIdentityCandidates(
  identityCandidates: ReadonlyArray<string>
): Promise<ResolvedPlus4uPerson> {
  const cacheKey = identityCandidates.join('|');
  const cached = myPersonCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let rejected: UubtApiError | null = null;

  const attempts = identityCandidates.flatMap(candidate => [
    ...uuIdentityCandidates(candidate),
  ]);

  for (const uuIdentity of attempts) {
    let person: Plus4uPersonRecord | undefined;
    try {
      // Sériově — další formát má smysl zkusit jen po odmítnutí předchozího.
      // oxlint-disable-next-line no-await-in-loop
      const response = await uubtGet<{
        itemList?: ReadonlyArray<Plus4uPersonRecord>;
      }>(UUBT_PEOPLE_BASE_URI, FIND_BY_IDENTITY_USE_CASE, { uuIdentity });
      person = response.itemList?.[0];
    } catch (error) {
      if (error instanceof UubtApiError && error.isInvalidDtoIn) {
        log.warn(
          `plus4uPeople findPerson odmítl tvar identity ${maskUuValueShape(uuIdentity)}`
        );
        rejected = error;
        continue;
      }
      throw error;
    }

    if (person) {
      const resolved: ResolvedPlus4uPerson = { uuIdentity, person };
      myPersonCache.set(cacheKey, resolved);
      return resolved;
    }

    log.warn(
      `plus4uPeople findPerson nic nevrátil pro tvar identity ${maskUuValueShape(uuIdentity)}`
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

/** uuIdentity přihlášeného uživatele — bez nároku na uuDigitalWorkspace. */
export async function getMyPlus4uIdentity(): Promise<string> {
  const { identityCandidates } = await getUubtTokenWithInteractiveLogin();
  const { uuIdentity } =
    await loadPlus4uPersonByIdentityCandidates(identityCandidates);
  return uuIdentity;
}

export function clearPlus4uPeopleCache(): void {
  myPersonCache.clear();
  profileCache.clear();
  photoCache.clear();
}
