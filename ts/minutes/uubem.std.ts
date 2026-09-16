// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { PersonName } from './personCard.std.ts';

/**
 * uuBEM instance s vizitkami osob. Stejná, jakou používá webové uuBEM
 * (`personCard/findBusinessCard`, `personCard/loadBusinessCard`).
 */
export const UUBEM_BASE_URI =
  'https://uuapp.plus4u.net/uu-bem-maing01/82cd166f15994dac8672322b7f300180';

/** Stránka osoby ve webovém uuBEM — tam jde vizitka i doplnit. */
export function getUubemPersonDetailUrl(id: string): string {
  return `${UUBEM_BASE_URI}/personDetail?id=${encodeURIComponent(id)}`;
}

/** Řádek výsledku hledání. uuBEM v seznamu kontakty neposílá. */
export type UubemBusinessCard = Readonly<{
  id: string;
  uuIdentity: string;
  name: PersonName;
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

/** Adresa na jeden řádek — bez prázdných částí. */
export function formatUubemAddress(address: UubemAddress): string {
  return [...address.lines, address.zip, address.country]
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .join(', ');
}
