// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { APP_DISPLAY_NAME, APP_README_LABEL } from './branding.std.ts';

export const UUMINUTES_WELCOME_TITLE = `Vítá vás ${APP_DISPLAY_NAME}`;

export const UUMINUTES_WELCOME_TAGLINE =
  'Rozšíření Signalu pro nahrávání hovorů, sumarizaci konverzací a AI asistenci u schůzek a chatů.';

export const UUMINUTES_WELCOME_FEATURES_HEADING =
  `Hlavní předností ${APP_DISPLAY_NAME} je:`;

/** Upstream Signal Desktop release (sync when merging upstream). */
export const UUMINUTES_SIGNAL_BASE_VERSION = '8.20.0';

export const UUMINUTES_README_LABEL = APP_README_LABEL;

export type UuMinutesWelcomeTileId =
  | 'chat-summary'
  | 'call-recording'
  | 'bookmarks'
  | 'about';

export type UuMinutesWelcomeTile = Readonly<{
  id: UuMinutesWelcomeTileId;
  title: string;
  description: string;
}>;

export const UUMINUTES_WELCOME_TILES: ReadonlyArray<UuMinutesWelcomeTile> = [
  {
    id: 'chat-summary',
    title: 'Sumarizace konverzací',
    description:
      'Proměňte své konverzace v přehledné poznámky. Exportujte chat do Markdownu nebo si nechte vytvořit stručné AI shrnutí jediným kliknutím. Dostupné přímo z menu chatu, pravým kliknutím na zprávu nebo z nabídky daného chatu.',
  },
  {
    id: 'call-recording',
    title: 'Nahrávání a sumarizace hovorů',
    description:
      'Už nikdy neztraťte důležité informace z hovoru. Jedním kliknutím nahrajte individuální i skupinové hovory, po jejich skončení automaticky získejte přepis a přehledné AI shrnutí.',
  },
  {
    id: 'bookmarks',
    title: 'Záložky',
    description:
      'Mějte důležité zprávy vždy po ruce. Uložte si je mezi záložky a vraťte se k nim jediným kliknutím – bez zdlouhavého hledání v historii chatu.',
  },
  {
    id: 'about',
    title: `O ${APP_DISPLAY_NAME}`,
    description: '',
  },
];

export const UUMINUTES_AUTHOR = 'Ing. Martin Zmítko, Ph.D.';

/** Signal username — pro přidání kontaktu v aplikaci Signal. */
export const UUMINUTES_AUTHOR_SIGNAL_USERNAME = 'martinzmitko.01';

export function formatUuMinutesVersionLabel(appVersion: string): string {
  return `${appVersion} (Signal Desktop ${UUMINUTES_SIGNAL_BASE_VERSION})`;
}
