// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';
import lodash from 'lodash';

import { createLogger } from '../logging/log.std.ts';
import { resolveUsernameByLinkBase64 } from '../services/username.preload.ts';
import { isValidE164 } from '../util/isValidE164.std.ts';
import { fromWebSafeBase64 } from '../util/webSafeBase64.std.ts';
import { lookupConversationWithoutServiceId } from '../util/lookupConversationWithoutServiceId.preload.ts';
import type {
  UubemBusinessCard,
  UubemBusinessCardDetail,
  UubemSignalContact,
} from './uubem.std.ts';
import {
  formatUubemBusinessCardMessage,
  formatUubemCardName,
} from './uubem.std.ts';
import { formatChatMessageHeader } from './branding.std.ts';
import { sendSignalChatMessage } from './sendSignalChatMessage.preload.ts';
import { showMinutesBusinessCardsTab } from './navTabsService.preload.ts';
import { summaryUi } from './summaryUiEvents.std.ts';
import { isUubtIntegrationEnabled } from './uubtService.preload.ts';

const { noop } = lodash;

const log = createLogger('minutes/uubemService');

export async function findUubemBusinessCards(
  searchString: string
): Promise<ReadonlyArray<UubemBusinessCard>> {
  return ipcRenderer.invoke('minutes:uubem-find-business-cards', {
    searchString,
  });
}

export async function loadUubemBusinessCard(
  options: Readonly<{ id: string; uuIdentity: string }>
): Promise<UubemBusinessCardDetail> {
  return ipcRenderer.invoke('minutes:uubem-load-business-card', options);
}

/**
 * Rozpracované i hotové dotazy na fotku. Seznam výsledků se překresluje při
 * každém psaní, takže bez tohoto by stejný řádek posílal dotaz opakovaně.
 */
const photoRequests = new Map<string, Promise<string | null>>();

async function requestPersonPhoto(uuIdentity: string): Promise<string | null> {
  try {
    return await ipcRenderer.invoke('minutes:uubem-load-person-photo', {
      uuIdentity,
    });
  } catch (error) {
    // Zahodíme záznam, ať to jde zkusit znovu, až se vizitka příště zobrazí.
    photoRequests.delete(uuIdentity);
    log.warn(`loadUubemPersonPhoto failed for ${uuIdentity}`, error);
    return null;
  }
}

/** Fotka osoby jako data URL, nebo `null` když ji v Plus4U nemá. */
export async function loadUubemPersonPhoto(
  uuIdentity: string
): Promise<string | null> {
  const key = uuIdentity.trim();
  if (key.length === 0) {
    return null;
  }

  const pending = photoRequests.get(key);
  if (pending) {
    return pending;
  }

  const request = requestPersonPhoto(key);
  photoRequests.set(key, request);
  return request;
}

/** Pošle vizitku do vybraného Signal chatu. */
export async function shareUubemBusinessCard(
  options: Readonly<{ card: UubemBusinessCardDetail; conversationId: string }>
): Promise<boolean> {
  const header = formatChatMessageHeader(
    'business-card',
    formatUubemCardName(options.card)
  );
  const body = formatUubemBusinessCardMessage(options.card);

  return sendSignalChatMessage(
    options.conversationId,
    `${header}${body}`,
    'shareUubemBusinessCard'
  );
}

/**
 * Dohledá Signal konverzaci podle kontaktu z vizitky. Postup je stejný jako
 * u odkazů signal.me (`showConversationViaSignalDotMe`) — telefon přes CDS,
 * username přes server.
 */
async function resolveConversationId(
  contact: UubemSignalContact
): Promise<string | undefined> {
  const { showUserNotFoundModal } = window.reduxActions.globalModals;

  if (contact.kind === 'phoneNumber') {
    if (!isValidE164(contact.phoneNumber, true)) {
      return undefined;
    }
    return lookupConversationWithoutServiceId({
      type: 'e164',
      e164: contact.phoneNumber,
      phoneNumber: contact.phoneNumber,
      showUserNotFoundModal,
      setIsFetchingUUID: noop,
    });
  }

  const username =
    contact.kind === 'username'
      ? contact.username
      : await resolveUsernameByLinkBase64(
          fromWebSafeBase64(contact.encryptedUsername)
        );

  if (username == null) {
    return undefined;
  }

  return lookupConversationWithoutServiceId({
    type: 'username',
    username,
    showUserNotFoundModal,
    setIsFetchingUUID: noop,
  });
}

export type UubemMessageResult =
  | Readonly<{ status: 'ok' }>
  | Readonly<{ status: 'not-found' }>
  | Readonly<{ status: 'error'; message: string }>;

/**
 * Otevře chat s osobou z vizitky. Když Signal kontakt nikoho nenajde,
 * `lookupConversationWithoutServiceId` už si sám ukázal dialog.
 */
export async function openUubemSignalConversation(
  contact: UubemSignalContact
): Promise<UubemMessageResult> {
  try {
    const conversationId = await resolveConversationId(contact);
    if (conversationId == null) {
      return { status: 'not-found' };
    }

    window.reduxActions.conversations.showConversation({ conversationId });
    return { status: 'ok' };
  } catch (error) {
    log.error('openUubemSignalConversation failed', error);
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'Chat se nepodařilo otevřít.',
    };
  }
}

/**
 * Akce z menu Minutes. Bez zapnuté integrace tab v levé navigaci není,
 * takže se místo přepnutí jen vysvětlí, co si uživatel musí zapnout.
 */
export function openMinutesBusinessCards(): void {
  if (!isUubtIntegrationEnabled()) {
    summaryUi.showError(
      'Vizitky potřebují zapnutou integraci Plus4U — zapněte ji v Nastavení AI.'
    );
    setTimeout(() => summaryUi.hide(), 8000);
    return;
  }
  showMinutesBusinessCardsTab();
}
