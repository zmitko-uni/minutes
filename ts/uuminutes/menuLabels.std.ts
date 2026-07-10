// Copyright 2026 Minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  APP_DISPLAY_NAME,
  formatMenuActionLabel,
  formatMinutesScopedMenuLabel,
} from './branding.std.ts';

export const UUMINUTES_MENU_LABEL = APP_DISPLAY_NAME;

export const UUMINUTES_MENU_SUMMARIZE_CURRENT_CHAT =
  'Sumarizovat aktuální chat';

export const UUMINUTES_MENU_SUMMARIZE_UNREAD = 'Sesumarizuj nepřečtené';

export const UUMINUTES_MENU_BOOKMARKS = 'Záložky';

export const UUMINUTES_MENU_AI_SETTINGS = 'Nastavení AI';

export const UUMINUTES_MENU_CALL_TRANSCRIPTION_SETTINGS =
  formatMinutesScopedMenuLabel('Nastavení Přepisů');

export const UUMINUTES_MENU_README = 'Příručka';

export const UUMINUTES_MENU_SHOW_LOG = 'Zobrazit log';

export const UUMINUTES_MENU_ABOUT = `O ${APP_DISPLAY_NAME}`;

export const UUMINUTES_MENU_OPEN_RECORDINGS = 'Otevřít nahrávky hovorů';

export const UUMINUTES_MENU_OPEN_SUMMARIES = 'Otevřít sumarizace chatů';

export const UUMINUTES_MENU_SUMMARIZE_1H = 'Sumarizovat poslední 1 hodinu';

export const UUMINUTES_MENU_SUMMARIZE_8H = 'Sumarizovat poslední 8 hodin';

export const UUMINUTES_MENU_SUMMARIZE_24H = 'Sumarizovat poslední 24 hodin';

export const UUMINUTES_MENU_SUMMARIZE_FROM_HERE =
  formatMenuActionLabel('Sumarizovat odtud');

export const UUMINUTES_MENU_ADD_BOOKMARK =
  formatMenuActionLabel('Přidat do záložek');

export const UUMINUTES_MENU_TRANSCRIPTION_QUEUE =
  formatMinutesScopedMenuLabel('Přepisy');
