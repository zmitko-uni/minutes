# Plus4U integrace — poznámky k obnově

Integrace je z aktuálního stromu schovaná (vizitky, zápis ke schůzce, přístupové kódy i přihlášení přes prohlížeč). Tohle není uživatelská příručka. Až se k tomu budeme vracet, začni tady.

## Kde je celý kód

Poslední commit, ve kterém je implementace kompletní (UI jen vypnuté přepínačem `PLUS4U_INTEGRATION_AVAILABLE = false`):

- `29e4bcaf889902299a815331a9236fcffa5cf01d` na `main` (merge)
- stejný obsah feature commitu `51e27b9100746adcde76444f7b98ef0240366cb5` na `beta`

Obnova souborů z toho commitu:

```bash
git checkout 29e4bcaf889902299a815331a9236fcffa5cf01d -- \
  ts/minutes/uubt.std.ts \
  ts/minutes/uubtAuth.main.ts \
  ts/minutes/uubtAuthErrors.std.ts \
  ts/minutes/uubtAuthSession.main.ts \
  ts/minutes/uubtBrowserAuth.main.ts \
  ts/minutes/uubtCalendar.main.ts \
  ts/minutes/uubtClient.main.ts \
  ts/minutes/uubtIntegration.preload.ts \
  ts/minutes/uubtMeetingActivity.main.ts \
  ts/minutes/uubtMeetingMinutes.main.ts \
  ts/minutes/uubtOidcCallback.std.ts \
  ts/minutes/uubtOidcJwt.main.ts \
  ts/minutes/uubtOidcPkce.std.ts \
  ts/minutes/uubtService.preload.ts \
  ts/minutes/uubtSettings.main.ts \
  ts/minutes/uubtTokenCache.main.ts \
  ts/minutes/uubtUu5.std.ts \
  ts/minutes/uubem.std.ts \
  ts/minutes/uubemPersonCard.main.ts \
  ts/minutes/plus4uPeople.main.ts \
  ts/minutes/plus4uIntegration.std.ts \
  ts/minutes/personCard.std.ts \
  ts/minutes/personCard.main.ts \
  ts/minutes/personCardService.preload.ts \
  ts/minutes/meetingTasks.std.ts \
  ts/minutes/meetingTaskPrompts.std.ts \
  ts/minutes/meetingTasksService.preload.ts \
  ts/minutes/recordingMeeting.std.ts \
  ts/minutes/components/MinutesBusinessCardsTab.dom.tsx \
  ts/minutes/components/MinutesSendToUubtModal.dom.tsx \
  ts/minutes/components/MinutesRecordingMeetingPane.dom.tsx \
  ts/minutes/components/MinutesMeetingTasksPanel.dom.tsx \
  stylesheets/components/MinutesBusinessCardsTab.scss \
  ts/test-node/minutes/uubtAuthErrors_test.std.ts \
  ts/test-node/minutes/uubtOidcCallback_test.std.ts
```

Samotný checkout souborů nestačí. V tom commitu jsou i tenké hooky v upstream a ve sdílených Minutes souborech (menu, NavTabs, Inbox, `minutes_channel`, Nastavení AI, detail nahrávky). Ty je potřeba vzít ze stejného commitu diffem, ne je vymýšlet znovu:

```bash
git diff HEAD 29e4bcaf889902299a815331a9236fcffa5cf01d -- \
  app/menu.std.ts app/main.main.ts app/minutes_channel.main.ts \
  ts/types/Nav.std.ts ts/types/menu.std.ts \
  ts/components/NavTabs.dom.tsx ts/components/Inbox.dom.tsx \
  ts/state/smart/NavTabs.preload.tsx ts/state/smart/Inbox.preload.tsx \
  ts/minutes/index.preload.ts ts/minutes/navTabs.std.ts \
  ts/minutes/navTabsService.preload.ts ts/minutes/menuLabels.std.ts \
  ts/minutes/constants.std.ts ts/minutes/friendlyError.std.ts \
  ts/minutes/components/MinutesSettingsModal.dom.tsx \
  ts/minutes/components/MinutesTranscriptsTab.dom.tsx \
  ts/minutes/components/MinutesRecordingDetail.dom.tsx \
  stylesheets/components/MinutesNavTabs.scss stylesheets/manifest.scss
```

Zapnutí v UI bylo jeden přepínač: `PLUS4U_INTEGRATION_AVAILABLE` v `ts/minutes/plus4uIntegration.std.ts`. Při `false` se tab, menu, nastavení ani zápis neukázaly a při startu se smazala uložená tajemství.

## Co to umělo

1. **Zápis ke schůzce** — hotové AI shrnutí nahrávky se vložilo na konec sekce Zápis schůzky v Plus4U (uuDigitalWorkspace / uuElementaryManagement). Schůzky se braly z kalendáře na den nahrávky, předvybrala se ta s největším časovým překryvem.
2. **Tab Schůzka** u nahrávky — příprava, zápis, účastníci, potvrzení aktivity (`solvedActive`), návrhy úkolů z textu zápisu a odeslání úkolu do chatu.
3. **Vizitky** — hledání v uuBEM a Plus4U People, sloučení podle uuIdentity, fotka, telefony, e-maily, Signal kontakt, „Napsat zprávu“, sdílení vizitky do chatu.

## Přihlášení (proč se to sundalo)

Dva způsoby, oba ukládaly tajemství:

- **Access code 1 + access code 2** — grant `password` na `POST {oidc}/grantToken`. Kódy v `uubt-settings.json` přes Electron `safeStorage` (bez safeStorage padaly do base64, což je špatně).
- **Prohlížeč (OIDC authorization code + PKCE S256)** — loopback HTTP server, refresh token taky v `safeStorage`. Client id `uu-oidc:unregistered-client:<random>`, client secret konstanta `unregistered`. 2FA účty kódy odmítaly (`unsupportedCredentials`) a musely do prohlížeče.

Výchozí OIDC:

`https://uuidentity.plus4u.net/uu-oidc-maing02/bb977a99f4cc4c37a2afce3fd599d0a7/oidc`

Soubor s tajemstvím: `%APPDATA%\Minutes\minutes\uubt-settings.json` (macOS: `~/Library/Application Support/Minutes/minutes/uubt-settings.json`, beta: `Minutes-Beta`). Po odstranění integrace se ten soubor při startu smaže.

Krátkodobý id_token byl jen v paměti main procesu (`uubtTokenCache.main.ts`), ne na disku.

## Tok volání

```
renderer (Nastavení / Vizitky / dialog zápisu)
  → IPC minutes:uubt-* a minutes:person-card-*
  → app/minutes_channel.main.ts
  → uubtAuth / uubtBrowserAuth (token)
  → uubtClient (HTTP + Bearer, jeden retry po 401)
  → uuApp příkazy (kalendář, stránka schůzky, uuBEM, Plus4U People)
```

Vizitky v levé liště: `useUubtIntegrationEnabled()` v `SmartNavTabs` → prop `minutesBusinessCardsEnabled` do `NavTabs.dom.tsx`. Prop, ne hook v `NavTabs.dom.tsx`, protože ten soubor nesmí importovat Electron (Storybook).

## IPC, které se mají vrátit

- `minutes:uubt-get-settings` / `save-settings` / `test-connection`
- `minutes:uubt-start-browser-login` / `cancel-browser-login` / `logout-browser`
- `minutes:uubt-list-meetings` / `load-meeting-texts` / `append-minutes` / `mark-meeting-solved`
- `minutes:person-card-search` / `load` / `me` / `photo`
- `minutes:get-recording-meeting` / `save-recording-meeting`
- `minutes:propose-meeting-tasks`

Vazba nahrávky na schůzku je soubor `<nahrávka>.meeting.json` vedle nahrávky (`recordingArtifacts.std.ts` → `meetingPath`). Mazání nahrávky ten soubor pořád smaže, i když se zápis do Plus4U neukazuje.

## uuApp, na které se sahalo

- uuOIDC `grantToken` (password i authorization_code / refresh_token)
- uuPlus4UPeople — dwUri uživatele, profily, fotky, kontakty
- uuBEM `personCard` — firemní vizitky
- kalendář uuDigitalWorkspace — schůzky dne
- stránka schůzky (uuEcc / sekce `UuElementaryManagement.Meeting.Detail*`) — čtení a připojení zápisu
- `uuArtifactIfc/activity/elementary/setState` — uzavření schůzky

Markdown shrnutí se do sekce překládal v `uubtUu5.std.ts`. Duplicitní vložení stejného zápisu (stejný název hovoru a čas) vracelo stav `duplicate`, ne chybu.

## Od kdy to bylo v releasech

První release s uuBT zápisem: **`v8.26.0-m1.3.1-beta.2`**. Všechny novější GitHub Releases (včetně `v8.26.0-m1.6.2` a `v8.26.0-m1.6.0-beta.4`) tu integraci obsahovaly a byly smazané. Starší latest bez ní je **`v8.25.0-m1.3.1`**.
