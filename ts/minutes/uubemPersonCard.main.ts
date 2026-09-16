// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import type {
  UubemAddress,
  UubemBusinessCard,
  UubemBusinessCardDetail,
  UubemEmail,
  UubemPhone,
} from './uubem.std.ts';
import { UUBEM_BASE_URI } from './uubem.std.ts';
import { PERSON_CARD_MIN_SEARCH_LENGTH } from './personCard.std.ts';
import { uubtGet } from './uubtClient.main.ts';

const log = createLogger('minutes/uubemPersonCard');

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === 'string' ? value.trim() : '';
}

function toRecordList(value: unknown): ReadonlyArray<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is Record<string, unknown> =>
      item != null && typeof item === 'object'
  );
}

function parseCard(source: Record<string, unknown>): UubemBusinessCard | null {
  const id = readString(source, 'id');
  const uuIdentity = readString(source, 'uuIdentity');
  if (id.length === 0 || uuIdentity.length === 0) {
    return null;
  }

  return {
    id,
    uuIdentity,
    name: {
      titleBefore: readString(source, 'titleBefore'),
      name: readString(source, 'name'),
      middleName: readString(source, 'middleName'),
      surname: readString(source, 'surname'),
      suffix: readString(source, 'suffix'),
      titleAfter: readString(source, 'titleAfter'),
    },
  };
}

function parsePhoneList(value: unknown): ReadonlyArray<UubemPhone> {
  return toRecordList(value)
    .map(item => ({
      phone: readString(item, 'phone'),
      description: readString(item, 'description'),
    }))
    .filter(item => item.phone.length > 0);
}

function parseEmailList(value: unknown): ReadonlyArray<UubemEmail> {
  return toRecordList(value)
    .map(item => ({
      email: readString(item, 'email'),
      description: readString(item, 'description'),
    }))
    .filter(item => item.email.length > 0);
}

function parseAddressList(value: unknown): ReadonlyArray<UubemAddress> {
  return toRecordList(value)
    .map(item => ({
      lines: ['addressLine1', 'addressLine2', 'addressLine3']
        .map(key => readString(item, key))
        .filter(line => line.length > 0),
      zip: readString(item, 'zip'),
      country: readString(item, 'country'),
    }))
    .filter(item => item.lines.length > 0);
}

/** Vizitky odpovídající hledanému textu (jméno, příjmení, uuIdentity). */
export async function findUubemBusinessCards(
  searchString: string
): Promise<ReadonlyArray<UubemBusinessCard>> {
  const trimmed = searchString.trim();
  if (trimmed.length < PERSON_CARD_MIN_SEARCH_LENGTH) {
    return [];
  }

  const response = await uubtGet<Record<string, unknown>>(
    UUBEM_BASE_URI,
    'personCard/findBusinessCard',
    { searchString: trimmed }
  );

  const cards = toRecordList(response?.itemList)
    .map(parseCard)
    .filter((card): card is UubemBusinessCard => card != null);

  log.info(`uubem findBusinessCard returned ${cards.length} cards`);
  return cards;
}

/** Celá vizitka včetně kontaktů a případného Signal kontaktu. */
export async function loadUubemBusinessCard(
  options: Readonly<{ id: string; uuIdentity: string }>
): Promise<UubemBusinessCardDetail> {
  const response = await uubtGet<Record<string, unknown>>(
    UUBEM_BASE_URI,
    'personCard/loadBusinessCard',
    { id: options.id, uuIdentity: options.uuIdentity }
  );

  const card = parseCard(response ?? {});
  if (!card) {
    throw new Error('uuBEM vrátil vizitku bez identifikátoru osoby.');
  }

  const signalUri = readString(response ?? {}, 'signalUri');
  log.info(
    `uubem loadBusinessCard ok (signalUri=${signalUri.length > 0 ? 'ano' : 'ne'})`
  );

  return {
    ...card,
    phoneList: parsePhoneList(response?.phoneList),
    emailList: parseEmailList(response?.emailList),
    addressList: parseAddressList(response?.addressList),
    signalUri: signalUri.length > 0 ? signalUri : null,
  };
}
