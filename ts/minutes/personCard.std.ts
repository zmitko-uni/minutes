// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { parseSignalRoute } from '../util/signalRoutes.std.ts';

/**
 * Osoby vedou dva zdroje Plus4U a ani jeden z nich není nadmnožinou toho
 * druhého — uuBEM má firemní vizitky, Plus4U People profily lidí. Vizitka
 * v Minutes je proto sloučením obojího podle uuIdentity.
 */
export type PersonCardSource = 'uubem' | 'plus4u-people';

export const PERSON_CARD_SOURCE_LABELS: Readonly<
  Record<PersonCardSource, string>
> = {
  uubem: 'uuBEM',
  'plus4u-people': 'Plus4U People',
};

/** Pořadí filtrů i sloučených výsledků — uuBEM napřed, má tituly a id. */
export const PERSON_CARD_SOURCES: ReadonlyArray<PersonCardSource> = [
  'uubem',
  'plus4u-people',
];

/** Kratší text nemá smysl posílat — zdroje vrátí stovky osob. */
export const PERSON_CARD_MIN_SEARCH_LENGTH = 2;

/**
 * Plus4U People vrací na obecný dotaz až 999 osob. Každý řádek seznamu si
 * říká o fotku, takže neomezený výsledek znamená stovky souběžných stažení
 * — seznam se ořízne a uživateli se řekne, ať hledání upřesní.
 */
export const PERSON_CARD_SEARCH_LIMIT = 50;

export type PersonName = Readonly<{
  titleBefore: string;
  name: string;
  middleName: string;
  surname: string;
  suffix: string;
  titleAfter: string;
}>;

export const EMPTY_PERSON_NAME: PersonName = {
  titleBefore: '',
  name: '',
  middleName: '',
  surname: '',
  suffix: '',
  titleAfter: '',
};

/** Řádek výsledku hledání — jedna osoba, i když ji vrátily oba zdroje. */
export type PersonSearchResult = Readonly<{
  uuIdentity: string;
  name: PersonName;
  /** Identifikátor vizitky v uuBEM; `null`, když osoba v uuBEM vizitku nemá. */
  uubemId: string | null;
  sources: ReadonlyArray<PersonCardSource>;
}>;

/** Telefon nebo e-mail. Stejnou hodnotu z obou zdrojů držíme jen jednou. */
export type PersonContact = Readonly<{
  value: string;
  description: string;
  sources: ReadonlyArray<PersonCardSource>;
}>;

export type PersonAddress = Readonly<{
  text: string;
  sources: ReadonlyArray<PersonCardSource>;
}>;

/**
 * Signal kontakt není v žádném ze zdrojů validovaný, takže může nést
 * username, telefon i celý odkaz signal.me. Každý z tvarů se v Signalu
 * dohledává jinak.
 */
export type PersonSignalContact =
  | Readonly<{ kind: 'username'; username: string }>
  | Readonly<{ kind: 'phoneNumber'; phoneNumber: string }>
  | Readonly<{ kind: 'encryptedUsername'; encryptedUsername: string }>;

/**
 * Jedno tlačítko „Napsat zprávu“. Zdroje se v Signal kontaktu i v telefonu
 * běžně rozcházejí a ani jeden z nich není autorita, takže se nevybírá
 * za uživatele — dostane všechny možnosti a zkusí, která projde.
 */
export type PersonSignalCandidate = Readonly<{
  /** Stabilní klíč tlačítka — normalizovaná hodnota kontaktu. */
  key: string;
  contact: PersonSignalContact;
  label: string;
  sources: ReadonlyArray<PersonCardSource>;
  /** Vzniklo z telefonního čísla, ne z vyplněného pole Signal. */
  fromPhoneNumber: boolean;
}>;

/** Chyba jednoho zdroje. Druhý zdroj se kvůli ní zobrazit nepřestane. */
export type PersonSourceError = Readonly<{
  source: PersonCardSource;
  message: string;
}>;

/** Celá vizitka osoby — sloučení uuBEM a Plus4U People. */
export type PersonCardDetail = Readonly<{
  uuIdentity: string;
  name: PersonName;
  uubemId: string | null;
  sources: ReadonlyArray<PersonCardSource>;
  phoneList: ReadonlyArray<PersonContact>;
  emailList: ReadonlyArray<PersonContact>;
  addressList: ReadonlyArray<PersonAddress>;
  signalCandidates: ReadonlyArray<PersonSignalCandidate>;
  sourceErrors: ReadonlyArray<PersonSourceError>;
}>;

/** Jméno pro seznam i detail — „Ing. Martin Zmítko, Ph.D.“. */
export function formatPersonName(name: PersonName): string {
  const base = [
    name.titleBefore,
    name.name,
    name.middleName,
    name.surname,
    name.suffix,
  ]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ');

  const titleAfter = name.titleAfter.trim();
  if (titleAfter.length === 0) {
    return base;
  }
  return base.length > 0 ? `${base}, ${titleAfter}` : titleAfter;
}

/** Iniciály pro kolečko s avatarem, když osoba nemá fotku. */
export function getPersonInitials(name: PersonName): string {
  const first = name.name.trim().slice(0, 1);
  const last = name.surname.trim().slice(0, 1);
  const initials = `${first}${last}`.trim();
  if (initials.length > 0) {
    return initials.toUpperCase();
  }
  // Zdroj může poslat jen celé jméno v jednom poli.
  return formatPersonName(name).trim().slice(0, 1).toUpperCase();
}

/**
 * Zdroje zapisují telefony různě — uuBEM jako `(+420)773798027`,
 * Plus4U People i s mezerami. Signal chce E164, tedy jen `+` a číslice.
 */
export function normalizePersonPhoneNumber(value: string): string {
  const compact = value.replace(/[\s\u00a0()./-]/g, '');
  if (compact.startsWith('00')) {
    return `+${compact.slice(2)}`;
  }
  return compact;
}

/** Hodnota vypadá na telefon, ne na Signal username. */
function looksLikePhoneNumber(value: string): boolean {
  if (!/^[+\d\s\u00a0()./-]+$/.test(value)) {
    return false;
  }
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9;
}

/**
 * Rozpozná, co je v poli Signal zapsané. Odkazy signal.me se parsují
 * upstream routerem, aby se tvary odkazů držely na jednom místě.
 */
export function parsePersonSignalContact(
  signalUri: string | null
): PersonSignalContact | null {
  const trimmed = signalUri?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }

  const route = parseSignalRoute(trimmed);
  if (route?.key === 'contactByPhoneNumber') {
    return {
      kind: 'phoneNumber',
      phoneNumber: normalizePersonPhoneNumber(route.args.phoneNumber),
    };
  }
  if (route?.key === 'contactByEncryptedUsername') {
    return {
      kind: 'encryptedUsername',
      encryptedUsername: route.args.encryptedUsername,
    };
  }
  // Jiný signal.me odkaz (skupina, hovor) osobu nezastupuje.
  if (route != null) {
    return null;
  }

  if (looksLikePhoneNumber(trimmed)) {
    return {
      kind: 'phoneNumber',
      phoneNumber: normalizePersonPhoneNumber(trimmed),
    };
  }

  const username = trimmed.replace(/^@/, '');
  return username.length > 0 ? { kind: 'username', username } : null;
}

/** Popis Signal kontaktu do detailu vizitky. */
export function describePersonSignalContact(
  contact: PersonSignalContact
): string {
  if (contact.kind === 'phoneNumber') {
    return contact.phoneNumber;
  }
  if (contact.kind === 'username') {
    return contact.username;
  }
  return 'odkaz signal.me';
}

function signalContactKey(contact: PersonSignalContact): string {
  if (contact.kind === 'phoneNumber') {
    return `phone:${contact.phoneNumber}`;
  }
  if (contact.kind === 'username') {
    return `username:${contact.username.toLowerCase()}`;
  }
  return `link:${contact.encryptedUsername}`;
}

function mergeSources(
  left: ReadonlyArray<PersonCardSource>,
  right: ReadonlyArray<PersonCardSource>
): ReadonlyArray<PersonCardSource> {
  const merged = [...left];
  for (const source of right) {
    if (!merged.includes(source)) {
      merged.push(source);
    }
  }
  return merged;
}

/** Popisek zdrojů pod hodnotou — „uuBEM · Plus4U People“. */
export function describePersonSources(
  sources: ReadonlyArray<PersonCardSource>
): string {
  return sources.map(source => PERSON_CARD_SOURCE_LABELS[source]).join(' · ');
}

/** Porovnání uuIdentity napříč zápisem s pomlčkami i bez nich. */
export function normalizeUuIdentityKey(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : value.trim().toLowerCase();
}

/** Zdroj s vyplněnějším jménem vyhrává, prázdná pole doplní ten druhý. */
export function mergePersonNames(
  primary: PersonName,
  secondary: PersonName
): PersonName {
  const pick = (left: string, right: string): string =>
    left.trim().length > 0 ? left.trim() : right.trim();

  return {
    titleBefore: pick(primary.titleBefore, secondary.titleBefore),
    name: pick(primary.name, secondary.name),
    middleName: pick(primary.middleName, secondary.middleName),
    surname: pick(primary.surname, secondary.surname),
    suffix: pick(primary.suffix, secondary.suffix),
    titleAfter: pick(primary.titleAfter, secondary.titleAfter),
  };
}

/**
 * Sloučí stejné kontakty z obou zdrojů do jednoho řádku. Porovnává se
 * normalizovaná hodnota, aby `(+420)773798027` a `+420 773 798 027`
 * neskončily jako dva telefony téže osoby.
 */
export function mergePersonContacts(
  items: ReadonlyArray<PersonContact>,
  normalize: (value: string) => string
): ReadonlyArray<PersonContact> {
  const byValue = new Map<string, PersonContact>();

  for (const item of items) {
    const value = item.value.trim();
    if (value.length === 0) {
      continue;
    }
    const key = normalize(value);
    const existing = byValue.get(key);
    if (existing == null) {
      byValue.set(key, { ...item, value });
      continue;
    }
    byValue.set(key, {
      value: existing.value,
      description:
        existing.description.length > 0
          ? existing.description
          : item.description,
      sources: mergeSources(existing.sources, item.sources),
    });
  }

  return [...byValue.values()];
}

export function mergePersonAddresses(
  items: ReadonlyArray<PersonAddress>
): ReadonlyArray<PersonAddress> {
  const byText = new Map<string, PersonAddress>();

  for (const item of items) {
    const text = item.text.trim();
    if (text.length === 0) {
      continue;
    }
    const key = text.toLowerCase().replace(/\s+/g, ' ');
    const existing = byText.get(key);
    byText.set(
      key,
      existing == null
        ? { ...item, text }
        : {
            text: existing.text,
            sources: mergeSources(existing.sources, item.sources),
          }
    );
  }

  return [...byText.values()];
}

/**
 * Tlačítka „Napsat zprávu“. Vyplněný Signal kontakt má přednost; telefony
 * se nabízejí jen jako náhradník, protože podle nich Signal osobu taky najde,
 * ale zdaleka ne vždycky.
 */
export function buildPersonSignalCandidates(
  options: Readonly<{
    signalUris: ReadonlyArray<
      Readonly<{ uri: string; source: PersonCardSource }>
    >;
    phoneList: ReadonlyArray<PersonContact>;
  }>
): ReadonlyArray<PersonSignalCandidate> {
  const byKey = new Map<string, PersonSignalCandidate>();

  const add = (
    contact: PersonSignalContact,
    sources: ReadonlyArray<PersonCardSource>,
    fromPhoneNumber: boolean
  ): void => {
    const key = signalContactKey(contact);
    const existing = byKey.get(key);
    if (existing != null) {
      byKey.set(key, {
        ...existing,
        sources: mergeSources(existing.sources, sources),
        fromPhoneNumber: existing.fromPhoneNumber && fromPhoneNumber,
      });
      return;
    }
    byKey.set(key, {
      key,
      contact,
      label: describePersonSignalContact(contact),
      sources,
      fromPhoneNumber,
    });
  };

  for (const { uri, source } of options.signalUris) {
    const contact = parsePersonSignalContact(uri);
    if (contact != null) {
      add(contact, [source], false);
    }
  }

  const hasExplicitContact = byKey.size > 0;
  if (hasExplicitContact) {
    return [...byKey.values()];
  }

  for (const phone of options.phoneList) {
    const phoneNumber = normalizePersonPhoneNumber(phone.value);
    if (looksLikePhoneNumber(phoneNumber)) {
      add({ kind: 'phoneNumber', phoneNumber }, phone.sources, true);
    }
  }

  return [...byKey.values()];
}

function withDescription(value: string, description: string): string {
  const note = description.trim();
  return note.length > 0 ? `${value} (${note})` : value;
}

/**
 * Vizitka jako text do chatu. Signal zprávy jsou čistý text, takže strukturu
 * drží popisky na začátku řádků — příjemce tak vidí, co je co, i bez Minutes.
 */
export function formatPersonCardMessage(
  card: PersonCardDetail,
  uubemUrl: string | null
): string {
  const lines: Array<string> = [`uuIdentity: ${card.uuIdentity}`];

  for (const item of card.phoneList) {
    lines.push(`Telefon: ${withDescription(item.value, item.description)}`);
  }
  for (const item of card.emailList) {
    lines.push(`E-mail: ${withDescription(item.value, item.description)}`);
  }
  for (const address of card.addressList) {
    lines.push(`Adresa: ${address.text}`);
  }

  // Telefon už je o pár řádků výš, znovu ho jako „Signal“ neopakujeme.
  for (const candidate of card.signalCandidates) {
    if (!candidate.fromPhoneNumber) {
      lines.push(`Signal: ${candidate.label}`);
    }
  }

  if (uubemUrl != null) {
    lines.push(`Vizitka v uuBEM: ${uubemUrl}`);
  }

  return lines.join('\n');
}
