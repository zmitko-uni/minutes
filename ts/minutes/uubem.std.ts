// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { parseSignalRoute } from '../util/signalRoutes.std.ts';

/**
 * uuBEM instance s vizitkami osob. Stejná, jakou používá webové uuBEM
 * (`personCard/findBusinessCard`, `personCard/loadBusinessCard`).
 */
export const UUBEM_BASE_URI =
  'https://uuapp.plus4u.net/uu-bem-maing01/82cd166f15994dac8672322b7f300180';

/** Kratší text nemá smysl posílat — uuBEM vrátí stovky vizitek. */
export const UUBEM_MIN_SEARCH_LENGTH = 2;

/** Stránka osoby ve webovém uuBEM — tam jde vizitka i doplnit. */
export function getUubemPersonDetailUrl(id: string): string {
  return `${UUBEM_BASE_URI}/personDetail?id=${encodeURIComponent(id)}`;
}

/**
 * Fotky osob uuBEM nemá (v jeho 331 uuCmd žádný photo endpoint není) —
 * servíruje je uuPlus4UPeople (`UUBT_PEOPLE_BASE_URI`) podle uuIdentity,
 * a to přímo jako JPEG, ne jako JSON.
 */
export const UUBEM_PERSON_PHOTO_USE_CASE = 'getPersonPhotoByUuIdentity';

/** Řádek výsledku hledání. uuBEM v seznamu kontakty neposílá. */
export type UubemBusinessCard = Readonly<{
  id: string;
  uuIdentity: string;
  titleBefore: string;
  name: string;
  middleName: string;
  surname: string;
  suffix: string;
  titleAfter: string;
}>;

export type UubemPhone = Readonly<{
  phone: string;
  description: string;
}>;

export type UubemEmail = Readonly<{
  email: string;
  description: string;
}>;

export type UubemAddress = Readonly<{
  /** `addressLine1..3` bez prázdných řádků. */
  lines: ReadonlyArray<string>;
  zip: string;
  country: string;
}>;

/** Celá vizitka z `personCard/loadBusinessCard`. */
export type UubemBusinessCardDetail = UubemBusinessCard &
  Readonly<{
    phoneList: ReadonlyArray<UubemPhone>;
    emailList: ReadonlyArray<UubemEmail>;
    addressList: ReadonlyArray<UubemAddress>;
    /** Pole `signalUri`; karty bez Signal kontaktu ho vůbec nemají. */
    signalUri: string | null;
  }>;

/**
 * `signalUri` na vizitce není nijak validované, takže může nést username,
 * telefon i celý odkaz signal.me. Každý z tvarů se v Signalu dohledává jinak.
 */
export type UubemSignalContact =
  | Readonly<{ kind: 'username'; username: string }>
  | Readonly<{ kind: 'phoneNumber'; phoneNumber: string }>
  | Readonly<{ kind: 'encryptedUsername'; encryptedUsername: string }>;

/** Jméno pro seznam i detail — „Ing. Martin Zmítko, Ph.D.“. */
export function formatUubemCardName(
  card: Readonly<{
    titleBefore: string;
    name: string;
    middleName: string;
    surname: string;
    suffix: string;
    titleAfter: string;
  }>
): string {
  const base = [
    card.titleBefore,
    card.name,
    card.middleName,
    card.surname,
    card.suffix,
  ]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(' ');

  const titleAfter = card.titleAfter.trim();
  if (titleAfter.length === 0) {
    return base;
  }
  return base.length > 0 ? `${base}, ${titleAfter}` : titleAfter;
}

/** Iniciály pro kolečko s avatarem, když vizitka nemá fotku. */
export function getUubemCardInitials(
  card: Readonly<{ name: string; surname: string }>
): string {
  const first = card.name.trim().slice(0, 1);
  const last = card.surname.trim().slice(0, 1);
  return `${first}${last}`.toUpperCase();
}

/**
 * uuBEM ukládá telefony jako `(+420)773798027`. Signal chce E164,
 * tedy jen `+` a číslice.
 */
export function normalizeUubemPhoneNumber(value: string): string {
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
 * Rozpozná, co je v `signalUri` zapsané. Odkazy signal.me se parsují
 * upstream routerem, aby se tvary odkazů držely na jednom místě.
 */
export function parseUubemSignalContact(
  signalUri: string | null
): UubemSignalContact | null {
  const trimmed = signalUri?.trim() ?? '';
  if (trimmed.length === 0) {
    return null;
  }

  const route = parseSignalRoute(trimmed);
  if (route?.key === 'contactByPhoneNumber') {
    return {
      kind: 'phoneNumber',
      phoneNumber: normalizeUubemPhoneNumber(route.args.phoneNumber),
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
      phoneNumber: normalizeUubemPhoneNumber(trimmed),
    };
  }

  const username = trimmed.replace(/^@/, '');
  return username.length > 0 ? { kind: 'username', username } : null;
}

/** Popis Signal kontaktu do detailu vizitky. */
export function describeUubemSignalContact(
  contact: UubemSignalContact
): string {
  if (contact.kind === 'phoneNumber') {
    return contact.phoneNumber;
  }
  if (contact.kind === 'username') {
    return contact.username;
  }
  return 'odkaz signal.me';
}

function withDescription(value: string, description: string): string {
  const note = description.trim();
  return note.length > 0 ? `${value} (${note})` : value;
}

/** Adresa na jeden řádek — bez prázdných částí. */
export function formatUubemAddress(address: UubemAddress): string {
  return [...address.lines, address.zip, address.country]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(', ');
}

/**
 * Vizitka jako text do chatu. Signal zprávy jsou čistý text, takže strukturu
 * drží popisky na začátku řádků — příjemce tak vidí, co je co, i bez Minutes.
 */
export function formatUubemBusinessCardMessage(
  card: UubemBusinessCardDetail
): string {
  const lines: Array<string> = [`uuIdentity: ${card.uuIdentity}`];

  for (const item of card.phoneList) {
    lines.push(`Telefon: ${withDescription(item.phone, item.description)}`);
  }
  for (const item of card.emailList) {
    lines.push(`E-mail: ${withDescription(item.email, item.description)}`);
  }
  for (const address of card.addressList) {
    const formatted = formatUubemAddress(address);
    if (formatted.length > 0) {
      lines.push(`Adresa: ${formatted}`);
    }
  }

  const signalContact = parseUubemSignalContact(card.signalUri);
  if (signalContact != null) {
    lines.push(`Signal: ${describeUubemSignalContact(signalContact)}`);
  }

  lines.push(`Vizitka v uuBEM: ${getUubemPersonDetailUrl(card.id)}`);

  return lines.join('\n');
}
