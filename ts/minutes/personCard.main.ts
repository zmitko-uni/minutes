// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type {
  PersonCardDetail,
  PersonCardSource,
  PersonContact,
  PersonName,
  PersonSearchResult,
  PersonSourceError,
} from './personCard.std.ts';
import {
  buildPersonSignalCandidates,
  EMPTY_PERSON_NAME,
  mergePersonAddresses,
  mergePersonContacts,
  mergePersonNames,
  normalizePersonPhoneNumber,
  normalizeUuIdentityKey,
  PERSON_CARD_MIN_SEARCH_LENGTH,
  PERSON_CARD_SEARCH_LIMIT,
} from './personCard.std.ts';
import type {
  UubemBusinessCard,
  UubemBusinessCardDetail,
} from './uubem.std.ts';
import { formatUubemAddress } from './uubem.std.ts';
import {
  findUubemBusinessCards,
  loadUubemBusinessCard,
} from './uubemPersonCard.main.ts';
import type {
  Plus4uPeopleSearchResult,
  Plus4uPersonContacts,
  Plus4uPersonProfile,
} from './plus4uPeople.main.ts';
import {
  findPlus4uPeopleByName,
  getMyPlus4uIdentity,
  loadPlus4uPersonContacts,
  loadPlus4uPersonPhoto,
  loadPlus4uPersonProfile,
} from './plus4uPeople.main.ts';
import { isUubtEnabled } from './uubtSettings.main.ts';

const log = createLogger('minutes/personCard');

export type PersonCardSearchResponse = Readonly<{
  items: ReadonlyArray<PersonSearchResult>;
  /** Zdroj, který selhal. Druhý zdroj se kvůli němu nezahazuje. */
  sourceErrors: ReadonlyArray<PersonSourceError>;
  /**
   * Kolik osob dotazu odpovídá celkem, když se jich do `items` nevešlo víc.
   * `null` znamená, že seznam je úplný.
   */
  totalCount: number | null;
}>;

export type PersonCardSelection = Readonly<{
  uuIdentity: string;
  uubemId: string | null;
}>;

async function assertPersonCardsAvailable(): Promise<void> {
  if (!(await isUubtEnabled())) {
    throw new Error(
      'Integrace Plus4U není zapnutá — zapněte ji a doplňte access code 1 a 2 v Nastavení AI.'
    );
  }
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.length > 0
    ? error.message
    : String(error);
}

/** Zdroj se volá víckrát (profil + kontakty), hlásit ho chceme jednou. */
function dedupeSourceErrors(
  errors: ReadonlyArray<PersonSourceError>
): ReadonlyArray<PersonSourceError> {
  const bySource = new Map<PersonCardSource, PersonSourceError>();
  for (const error of errors) {
    if (!bySource.has(error.source)) {
      bySource.set(error.source, error);
    }
  }
  return [...bySource.values()];
}

/**
 * Jeden zdroj nesmí shodit celé hledání — uuBEM a Plus4U People jsou dvě
 * nezávislé aplikace a uživatel může mít oprávnění jen do jedné z nich.
 */
async function settleSource<T>(
  source: PersonCardSource,
  load: () => Promise<T>,
  fallback: T,
  errors: Array<PersonSourceError>
): Promise<T> {
  try {
    return await load();
  } catch (error) {
    log.warn(`personCard: zdroj ${source} selhal: ${toErrorMessage(error)}`);
    errors.push({ source, message: toErrorMessage(error) });
    return fallback;
  }
}

type MergedEntry = {
  uuIdentity: string;
  name: PersonName;
  uubemId: string | null;
  sources: Array<PersonCardSource>;
};

function upsertEntry(
  entries: Map<string, MergedEntry>,
  candidate: MergedEntry
): void {
  const key = normalizeUuIdentityKey(candidate.uuIdentity);
  const existing = entries.get(key);
  if (existing == null) {
    entries.set(key, candidate);
    return;
  }

  existing.name = mergePersonNames(existing.name, candidate.name);
  existing.uubemId ??= candidate.uubemId;
  for (const source of candidate.sources) {
    if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
  }
}

function toSearchResult(entry: MergedEntry): PersonSearchResult {
  return {
    uuIdentity: entry.uuIdentity,
    name: entry.name,
    uubemId: entry.uubemId,
    sources: entry.sources,
  };
}

/**
 * Osoby z uuBEM i z Plus4U People, sloučené podle uuIdentity. Vypnutý zdroj
 * se nevolá vůbec — filtr tak kromě seznamu ubere i dotazy do Plus4U.
 */
export async function searchPersonCards(
  searchString: string,
  enabledSources: ReadonlyArray<PersonCardSource>
): Promise<PersonCardSearchResponse> {
  await assertPersonCardsAvailable();

  const trimmed = searchString.trim();
  if (
    trimmed.length < PERSON_CARD_MIN_SEARCH_LENGTH ||
    enabledSources.length === 0
  ) {
    return { items: [], sourceErrors: [], totalCount: null };
  }

  const sourceErrors: Array<PersonSourceError> = [];
  const [uubemCards, peopleResult] = await Promise.all([
    enabledSources.includes('uubem')
      ? settleSource(
          'uubem',
          () => findUubemBusinessCards(trimmed),
          [] as ReadonlyArray<UubemBusinessCard>,
          sourceErrors
        )
      : Promise.resolve([] as ReadonlyArray<UubemBusinessCard>),
    enabledSources.includes('plus4u-people')
      ? settleSource(
          'plus4u-people',
          () => findPlus4uPeopleByName(trimmed),
          { profiles: [], totalCount: null } as Plus4uPeopleSearchResult,
          sourceErrors
        )
      : Promise.resolve({
          profiles: [],
          totalCount: null,
        } as Plus4uPeopleSearchResult),
  ]);
  const peopleProfiles = peopleResult.profiles;

  // uuBEM napřed — jeho vizitky nesou tituly a id, podle kterého jde otevřít web.
  const entries = new Map<string, MergedEntry>();
  for (const card of uubemCards) {
    upsertEntry(entries, {
      uuIdentity: card.uuIdentity,
      name: card.name,
      uubemId: card.id,
      sources: ['uubem'],
    });
  }
  for (const profile of peopleProfiles) {
    upsertEntry(entries, {
      uuIdentity: profile.uuIdentity,
      name: profile.name,
      uubemId: null,
      sources: ['plus4u-people'],
    });
  }

  const merged = [...entries.values()].map(toSearchResult);
  const items = merged.slice(0, PERSON_CARD_SEARCH_LIMIT);

  // Plus4U People hlásí vlastní strop dřív, než se k nám seznam vůbec dostane,
  // takže celkový počet bereme z něj, když ho pošle.
  const totalCount =
    merged.length > items.length || peopleResult.totalCount != null
      ? Math.max(peopleResult.totalCount ?? 0, merged.length)
      : null;

  log.info(
    `personCard: ${items.length} z ${merged.length} osob (uuBEM ${uubemCards.length}, Plus4U People ${peopleProfiles.length})`
  );
  return { items, sourceErrors, totalCount };
}

function toContacts(
  values: ReadonlyArray<Readonly<{ value: string; description: string }>>,
  source: PersonCardSource
): ReadonlyArray<PersonContact> {
  return values.map(item => ({
    value: item.value,
    description: item.description,
    sources: [source],
  }));
}

function normalizeEmail(value: string): string {
  return value.toLowerCase();
}

/**
 * Vizitka z uuBEM pro osobu, kterou seznam nabídl. Bez `uubemId` se dohledá
 * podle uuIdentity — řádek mohl vzniknout jen z Plus4U People (filtr zdrojů,
 * nebo uuBEM osobu pod hledaným jménem nenašel), ale detail má ukázat
 * všechno, co se o osobě ví.
 */
async function loadUubemCardForPerson(
  selection: PersonCardSelection,
  sourceErrors: Array<PersonSourceError>
): Promise<UubemBusinessCardDetail | null> {
  const { uuIdentity } = selection;

  return settleSource(
    'uubem',
    async () => {
      let { uubemId } = selection;

      if (uubemId == null) {
        const key = normalizeUuIdentityKey(uuIdentity);
        const cards = await findUubemBusinessCards(uuIdentity);
        uubemId =
          cards.find(card => normalizeUuIdentityKey(card.uuIdentity) === key)
            ?.id ?? null;
      }

      return uubemId == null
        ? null
        : loadUubemBusinessCard({ id: uubemId, uuIdentity });
    },
    null as UubemBusinessCardDetail | null,
    sourceErrors
  );
}

/** Vizitka osoby sloučená z obou zdrojů. */
export async function loadPersonCardDetail(
  selection: PersonCardSelection
): Promise<PersonCardDetail> {
  await assertPersonCardsAvailable();

  const sourceErrors: Array<PersonSourceError> = [];
  const { uuIdentity } = selection;

  const [uubemCard, peopleProfile, peopleContacts] = await Promise.all([
    loadUubemCardForPerson(selection, sourceErrors),
    settleSource(
      'plus4u-people',
      () => loadPlus4uPersonProfile(uuIdentity),
      null as Plus4uPersonProfile | null,
      sourceErrors
    ),
    settleSource(
      'plus4u-people',
      () => loadPlus4uPersonContacts(uuIdentity),
      {
        phoneList: [],
        emailList: [],
        addressList: [],
        signalUris: [],
      } as Plus4uPersonContacts,
      sourceErrors
    ),
  ]);

  const sources: Array<PersonCardSource> = [];
  if (uubemCard != null) {
    sources.push('uubem');
  }
  if (
    peopleProfile != null ||
    peopleContacts.phoneList.length > 0 ||
    peopleContacts.emailList.length > 0 ||
    peopleContacts.addressList.length > 0 ||
    peopleContacts.signalUris.length > 0
  ) {
    sources.push('plus4u-people');
  }

  const name = mergePersonNames(
    uubemCard?.name ?? EMPTY_PERSON_NAME,
    peopleProfile?.name ?? EMPTY_PERSON_NAME
  );

  const phoneList = mergePersonContacts(
    [
      ...toContacts(
        (uubemCard?.phoneList ?? []).map(item => ({
          value: item.phone,
          description: item.description,
        })),
        'uubem'
      ),
      ...peopleContacts.phoneList,
    ],
    normalizePersonPhoneNumber
  );

  const emailList = mergePersonContacts(
    [
      ...toContacts(
        (uubemCard?.emailList ?? []).map(item => ({
          value: item.email,
          description: item.description,
        })),
        'uubem'
      ),
      ...peopleContacts.emailList,
    ],
    normalizeEmail
  );

  const addressList = mergePersonAddresses([
    ...(uubemCard?.addressList ?? []).map(address => ({
      text: formatUubemAddress(address),
      sources: ['uubem'] as const,
    })),
    ...peopleContacts.addressList.map(text => ({
      text,
      sources: ['plus4u-people'] as const,
    })),
  ]);

  const signalCandidates = buildPersonSignalCandidates({
    signalUris: [
      ...(uubemCard?.signalUri != null
        ? [{ uri: uubemCard.signalUri, source: 'uubem' as const }]
        : []),
      ...peopleContacts.signalUris.map(uri => ({
        uri,
        source: 'plus4u-people' as const,
      })),
    ],
    phoneList,
  });

  return {
    uuIdentity,
    name,
    uubemId: uubemCard?.id ?? selection.uubemId,
    sources,
    phoneList,
    emailList,
    addressList,
    signalCandidates,
    sourceErrors: dedupeSourceErrors(sourceErrors),
  };
}

/** Fotka osoby jako data URL, nebo `null` když ji v Plus4U nemá. */
export async function loadPersonPhoto(
  uuIdentity: string
): Promise<string | null> {
  await assertPersonCardsAvailable();
  return loadPlus4uPersonPhoto(uuIdentity);
}

let myCard: PersonSearchResult | null = null;

/**
 * Vizitka přihlášeného uživatele. uuIdentity dá token, zbytek se dohledá
 * stejným hledáním jako u kohokoliv jiného, ať detail otevírá stejná cesta.
 */
export async function loadMyPersonCard(): Promise<PersonSearchResult | null> {
  await assertPersonCardsAvailable();

  if (myCard != null) {
    return myCard;
  }

  const uuIdentity = await getMyPlus4uIdentity();
  // Vlastní vizitka je jen zkratka nad hledáním — výpadek zdroje se uživateli
  // nehlásí, zůstane po něm jen chybějící štítek a záznam v logu.
  const ignoredErrors: Array<PersonSourceError> = [];

  const [uubemCards, profile] = await Promise.all([
    settleSource(
      'uubem',
      () => findUubemBusinessCards(uuIdentity),
      [] as ReadonlyArray<UubemBusinessCard>,
      ignoredErrors
    ),
    settleSource(
      'plus4u-people',
      () => loadPlus4uPersonProfile(uuIdentity),
      null as Plus4uPersonProfile | null,
      ignoredErrors
    ),
  ]);

  const key = normalizeUuIdentityKey(uuIdentity);
  const ownCard = uubemCards.find(
    card => normalizeUuIdentityKey(card.uuIdentity) === key
  );

  const sources: Array<PersonCardSource> = [];
  if (ownCard != null) {
    sources.push('uubem');
  }
  if (profile != null) {
    sources.push('plus4u-people');
  }

  const resolved: PersonSearchResult = {
    uuIdentity,
    name: mergePersonNames(
      ownCard?.name ?? EMPTY_PERSON_NAME,
      profile?.name ?? EMPTY_PERSON_NAME
    ),
    uubemId: ownCard?.id ?? null,
    sources,
  };

  // Když neodpověděl ani jeden zdroj, necachujeme — ať to příští otevření
  // tabu zkusí znovu a vizitka se neschová až do restartu.
  if (sources.length > 0) {
    myCard = resolved;
  }
  return resolved;
}

export function clearMyPersonCardCache(): void {
  myCard = null;
}
