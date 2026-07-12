// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { APP_DISPLAY_NAME, APP_README_LABEL } from './branding.std.ts';

export const MINUTES_WELCOME_TITLE = `Vítá vás ${APP_DISPLAY_NAME}`;

export const MINUTES_WELCOME_TAGLINE =
  'Rozšíření Signalu pro nahrávání hovorů, sumarizaci konverzací a AI asistenci u schůzek a chatů.';

export const MINUTES_WELCOME_FEATURES_HEADING =
  `Hlavní předností ${APP_DISPLAY_NAME} je:`;

/** @deprecated Import from ./version.std.ts */
export { formatMinutesVersionLabel, MINUTES_SIGNAL_BASE_VERSION } from './version.std.ts';

export type MinutesWelcomeTileId =
  | 'chat-summary'
  | 'call-recording'
  | 'bookmarks'
  | 'about';

export type MinutesWelcomeTile = Readonly<{
  id: MinutesWelcomeTileId;
  title: string;
  description: string;
}>;

export const MINUTES_WELCOME_TILES: ReadonlyArray<MinutesWelcomeTile> = [
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

export const MINUTES_AUTHOR = 'Ing. Martin Zmítko, Ph.D.';

/** Signal username — pro přidání kontaktu v aplikaci Signal. */
export const MINUTES_AUTHOR_SIGNAL_USERNAME = 'martinzmitko.01';

/** Veřejná Signal skupina Minutes — odkaz pro připojení. */
export const MINUTES_PUBLIC_SIGNAL_GROUP_URL =
  'https://signal.group/#CjQKIBP9zkSQgKhZKU8a8CmyyetVnaN2JVJtiFXWLtNOF_WlEhDj2Yr4HQMlB-P5tAEy2sQn';

export const MINUTES_PUBLIC_SIGNAL_GROUP_LINK_LABEL = 'Připojit se do skupiny';

export const MINUTES_README_LABEL = APP_README_LABEL;
